#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test for MockMail platform
# Usage: MOCKMAIL_EMAIL=you@example.com MOCKMAIL_PASSWORD=secret \
#        ./tests/mockmail_smoke.sh --api https://api.mockmail.dev --watch https://watch.mockmail.dev

API_BASE=""
WATCH_BASE=""
TIMEOUT=15
OUT_DIR="tests/output"
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT_JSON="$OUT_DIR/mockmail_smoke_$STAMP.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --api) API_BASE="$2"; shift 2;;
    --watch) WATCH_BASE="$2"; shift 2;;
    --timeout) TIMEOUT="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

if [ -z "${API_BASE}" ]; then
  API_BASE="http://localhost:3000"
fi
if [ -z "${WATCH_BASE}" ]; then
  WATCH_BASE="http://localhost:3001"
fi

EMAIL="${MOCKMAIL_EMAIL:-}"
PASSWORD="${MOCKMAIL_PASSWORD:-}"

jq_present() { command -v jq >/dev/null 2>&1; }
JQ="jq"
if ! jq_present; then JQ="python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin)))'"; fi

result_begin() { echo '{"started":"'"$(date -Iseconds)"'","api":"'"$API_BASE"'","watch":"'"$WATCH_BASE"'","checks":[]}' > "$OUT_JSON"; }
result_add() {
  local name="$1" status="$2" code="$3" latency="$4" note="$5"
  python3 - "$OUT_JSON" <<PY
import json,sys
p=sys.argv[1]
with open(p) as f: d=json.load(f)
d['checks'].append({'name':sys.argv[2],'status':sys.argv[3],'code':sys.argv[4],'latency_ms':float(sys.argv[5]),'note':sys.argv[6]})
with open(p,'w') as f: json.dump(d,f,indent=2)
PY "$name" "$status" "$code" "$latency" "$note" >/dev/null
}
result_end() {
  python3 - "$OUT_JSON" <<PY
import json,sys
p=sys.argv[1]
with open(p) as f: d=json.load(f)
succ=sum(1 for c in d['checks'] if c['status']=='PASS')
fail=sum(1 for c in d['checks'] if c['status']=='FAIL')
d['summary']={'total':len(d['checks']),'passed':succ,'failed':fail,'finished':'%s'}
with open(p,'w') as f: json.dump(d,f,indent=2)
PY "$(date -Iseconds)" >/dev/null
}

curl_code_time() {
  # args: method url data headers...
  local method="$1" url="$2" data="${3:-}"; shift 3 || true
  local extra=("$@")
  if [ -n "$data" ]; then
    out=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" -X "$method" "$url" --max-time "$TIMEOUT" -H 'Content-Type: application/json' -d "$data" "${extra[@]}")
  else
    out=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" -X "$method" "$url" --max-time "$TIMEOUT" "${extra[@]}")
  fi
  echo "$out"
}

say() { printf '%s\n' "$*"; }
pass() { say "[PASS] $*"; }
fail() { say "[FAIL] $*"; }

result_begin

# 1) Watch endpoint 200
code_time=$(curl_code_time GET "$WATCH_BASE" "")
code=${code_time% *}; t=${code_time#* }
if [ "$code" = "200" ]; then pass "WATCH $WATCH_BASE -> 200 (${t}s)"; result_add "watch_root" PASS "$code" "${t}000" ""; else fail "WATCH $WATCH_BASE -> $code"; result_add "watch_root" FAIL "$code" "${t}000" ""; fi

# 2) API health 200
code_time=$(curl_code_time GET "$API_BASE/api/health" "")
code=${code_time% *}; t=${code_time#* }
if [ "$code" = "200" ]; then pass "API health -> 200 (${t}s)"; result_add "api_health" PASS "$code" "${t}000" ""; else fail "API health -> $code"; result_add "api_health" FAIL "$code" "${t}000" ""; fi

TOKEN=""
if [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  # 3) Auth login 200
  resp=$(curl -s -X POST "$API_BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" --max-time "$TIMEOUT") || resp='{}'
  TOKEN=$(python3 -c 'import sys,json; print(json.loads(sys.stdin.read()).get("token",""))' <<<"$resp") || TOKEN=""
  if [ -n "$TOKEN" ]; then pass "Login ok (token recebido)"; result_add "auth_login" PASS 200 0 "token"; else fail "Login falhou"; result_add "auth_login" FAIL 0 0 "no-token"; fi

  # 4) Process email com body vazio -> 400 esperado
  code_time=$(curl_code_time POST "$API_BASE/api/mail/process" '{}' -H "Authorization: Bearer $TOKEN")
  code=${code_time% *}; t=${code_time#* }
  if [ "$code" = "400" ]; then pass "process vazio -> 400 (ok)"; result_add "process_empty" PASS "$code" "${t}000" "validation"; else fail "process vazio -> $code"; result_add "process_empty" FAIL "$code" "${t}000" ""; fi
fi

result_end
say "\nResumo JSON: $OUT_JSON"
