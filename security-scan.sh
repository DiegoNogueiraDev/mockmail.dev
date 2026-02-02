#!/usr/bin/env bash
set -u

TS="$(date +%Y%m%d-%H%M%S)"
HOST="$(hostname 2>/dev/null || echo unknown)"
REPORT_DIR="$HOME/security-report-$HOST-$TS"
mkdir -p "$REPORT_DIR"

LOG="$REPORT_DIR/00-run.log"
exec > >(tee -a "$LOG") 2>&1

echo "[*] Security triage report"
echo "    Host: $HOST"
echo "    Date: $(date)"
echo "    Report dir: $REPORT_DIR"
echo

have() { command -v "$1" >/dev/null 2>&1; }

run() {
  local name="$1"; shift
  local out="$REPORT_DIR/$name"
  echo "==> $name"
  {
    echo "\$ $*"
    "$@"
  } >"$out" 2>&1 || true
}

run_sh() {
  local name="$1"; shift
  local out="$REPORT_DIR/$name"
  echo "==> $name"
  {
    echo "\$ $*"
    bash -lc "$*"
  } >"$out" 2>&1 || true
}

is_root=0
if [ "${EUID:-$(id -u)}" -eq 0 ]; then is_root=1; fi

# Patterns commonly used in droppers/persistence (defensive grep only)
PATTERN='(curl|wget|tftp|ftp|python -c|perl -e|ruby -e|node -e|base64\s+-d|openssl\s+enc|bash\s+-c|sh\s+-c|nc\s+-e|ncat\s+-e|socat|mkfifo|LD_PRELOAD|authorized_keys|crontab|systemctl\s+--user|~\/\.config\/autostart|@reboot)'

echo "[*] Collecting system info..."
run "01-system.txt" uname -a
run "02-os-release.txt" bash -lc 'cat /etc/os-release 2>/dev/null; echo; uptime; echo; whoami; id; echo; date'
run "03-kernel-cmdline.txt" bash -lc 'cat /proc/cmdline 2>/dev/null'

echo "[*] Users & auth..."
run "10-users-uid0.txt" bash -lc 'awk -F: '\''$3==0{print}'\'' /etc/passwd'
run "11-last-logins.txt" bash -lc 'last -a | head -n 200'
run "12-loginctl.txt" bash -lc 'loginctl list-sessions --no-legend 2>/dev/null || true'

echo "[*] SSH keys (fingerprints only)..."
run_sh "20-ssh-keys-fingerprints.txt" '
  for f in "$HOME/.ssh/authorized_keys" "$HOME/.ssh/*.pub"; do
    [ -e "$f" ] || continue
    echo "## $f"
    if command -v ssh-keygen >/dev/null 2>&1; then
      ssh-keygen -lf "$f" 2>/dev/null || true
    else
      echo "(ssh-keygen not found)"
    fi
    echo
  done
  echo "## ssh config"
  [ -f "$HOME/.ssh/config" ] && sed -n "1,200p" "$HOME/.ssh/config" || true
'

echo "[*] Persistence checks (cron/systemd/autostart)..."
run_sh "30-crontab-user.txt" 'crontab -l 2>/dev/null || echo "(no user crontab)"'
run "31-cron-dirs.txt" bash -lc 'ls -la /etc/cron.* /etc/crontab 2>/dev/null || true'
run_sh "32-systemd-user-units.txt" '
  systemctl --user list-unit-files --no-pager 2>/dev/null || true
  echo
  systemctl --user list-timers --all --no-pager 2>/dev/null || true
'
run_sh "33-systemd-system-units.txt" '
  systemctl list-unit-files --type=service --no-pager 2>/dev/null | head -n 300 || true
  echo
  systemctl list-timers --all --no-pager 2>/dev/null || true
'
run_sh "34-autostart-desktop.txt" '
  d="$HOME/.config/autostart"
  if [ -d "$d" ]; then
    echo "## $d"
    ls -la "$d"
    echo
    for f in "$d"/*.desktop; do
      [ -e "$f" ] || continue
      echo "### $f"
      sed -n "1,200p" "$f"
      echo
    done
  else
    echo "(no ~/.config/autostart)"
  fi
'

echo "[*] Shell init files suspicious grep..."
run_sh "40-shell-init-grep.txt" '
  files=("$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile" "$HOME/.zshrc" "$HOME/.config/fish/config.fish" "$HOME/.bash_logout")
  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    echo "## $f"
    grep -nE "'"$PATTERN"'" "$f" || echo "(no hits)"
    echo
  done
'

echo "[*] Processes & network..."
run_sh "50-ps-top.txt" 'ps auxfww | head -n 300'
run_sh "51-procs-from-suspicious-paths.txt" '
  ps -eo pid,user,comm,args --no-headers | egrep -i "(/tmp/|/dev/shm/|/run/user/|\.cache/|\.local/tmp|\.config/)" | head -n 200 || true
'
run_sh "52-listening-ports.txt" '
  if command -v ss >/dev/null 2>&1; then
    ss -tulpen
    echo
    ss -tunap | head -n 250
  else
    echo "(ss not found)"
  fi
'
run_sh "53-resolver-hosts.txt" '
  echo "## /etc/hosts";  sed -n "1,200p" /etc/hosts 2>/dev/null || true
  echo; echo "## resolv.conf"; cat /etc/resolv.conf 2>/dev/null || true
'

echo "[*] Filesystem triage (recent executables + suspicious locations)..."
run_sh "60-recent-executables-home-7d.txt" '
  find "$HOME" -xdev -type f -mtime -7 \( -perm -111 -o -name "*.sh" -o -name "*.py" -o -name "*.pl" -o -name "*.js" \) 2>/dev/null \
    | head -n 500
'
run_sh "61-recent-executables-tmp-7d.txt" '
  for d in /tmp /var/tmp /dev/shm; do
    [ -d "$d" ] || continue
    echo "## $d"
    find "$d" -xdev -type f -mtime -7 -perm -111 2>/dev/null | head -n 300
    echo
  done
'
run_sh "62-dotfiles-suspicious-names.txt" '
  find "$HOME" -maxdepth 3 -type f 2>/dev/null \
    | egrep -i "(\.lock|\.pid|\.service|\.timer|\.desktop|\.socket|\.so$|\.ko$|\.bin$|\.dat$)" \
    | head -n 300 || true
'

if [ "$is_root" -eq 1 ]; then
  echo "[*] Root-only checks..."
  run_sh "70-suid-sgid.txt" '
    echo "## SUID"
    find / -xdev -type f -perm -4000 2>/dev/null | head -n 300
    echo; echo "## SGID"
    find / -xdev -type f -perm -2000 2>/dev/null | head -n 300
  '
  run_sh "71-systemd-overrides.txt" '
    echo "## /etc/systemd/system modified recently (30d)"
    find /etc/systemd/system -type f -mtime -30 2>/dev/null | sed -n "1,300p" || true
  '
  run_sh "72-journal-suspicious-7d.txt" '
    journalctl --since "7 days ago" --no-pager 2>/dev/null | egrep -i "'"$PATTERN"'" | head -n 400 || true
  '
else
  echo "[*] Skipping root-only checks (run with sudo for deeper coverage)."
fi

echo "[*] Packages (recent installs list)..."
run_sh "80-rpm-last.txt" '
  if command -v rpm >/dev/null 2>&1; then
    rpm -qa --last | head -n 200
  else
    echo "(rpm not found)"
  fi
'

echo "[*] Quick hits summary..."
run_sh "90-summary.txt" '
  echo "Report dir: '"$REPORT_DIR"'"
  echo
  echo "Suspicious grep hits in shell init files:"
  grep -RInE "'"$PATTERN"'" "'"$REPORT_DIR"'/40-shell-init-grep.txt" 2>/dev/null | head -n 50 || true
  echo
  echo "Possible processes from suspicious paths:"
  sed -n "1,120p" "'"$REPORT_DIR"'/51-procs-from-suspicious-paths.txt" 2>/dev/null || true
  echo
  echo "Listening ports:"
  sed -n "1,120p" "'"$REPORT_DIR"'/52-listening-ports.txt" 2>/dev/null || true
'

echo
echo "[✓] Done. Report saved to: $REPORT_DIR"
echo "    Tip: start by opening 90-summary.txt"
