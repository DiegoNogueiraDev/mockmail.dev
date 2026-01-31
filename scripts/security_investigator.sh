#!/bin/bash

# =============================================================================
# Security Investigator - Advanced Security Analysis Tool
# Detailed investigation of potentially suspicious activities
# =============================================================================

set -euo pipefail

# Colors for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_NAME="Security Investigator"
readonly VERSION="1.0.0"
readonly LOG_FILE="/var/log/security_investigation.log"

# =============================================================================
# Utility Functions
# =============================================================================

log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$timestamp] [$level] $message"
}

print_header() {
    local title="$1"
    echo -e "\n${BLUE}=================================================================================${NC}"
    echo -e "${WHITE}$title${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
}

print_section() {
    local title="$1"
    echo -e "\n${CYAN}🔍 $title${NC}"
    echo -e "${CYAN}$(printf '%.0s-' {1..60})${NC}"
}

show_banner() {
    clear
    echo -e "${RED}"
    cat << 'BANNER'
 ╔════════════════════════════════════════════════════════════════════════════╗
 ║  ____                      _ _           ___                        _      ║
 ║ / ___|  ___  ___ _   _ _ __(_) |_ _   _  |_ _|_ ____   _____  ___ ___| |_    ║
 ║ \___ \ / _ \/ __| | | | '__| | __| | | |  | || '_ \ \ / / _ \/ __/ __| __|   ║
 ║  ___) |  __/ (__| |_| | |  | | |_| |_| |  | || | | \ V /  __/\__ \__ \ |_    ║
 ║ |____/ \___|\___|\__,_|_|  |_|\__|\__, | |___|_| |_|\_/ \___||___/___/\__|   ║
 ║                                  |___/                                     ║
 ╚════════════════════════════════════════════════════════════════════════════╝
BANNER
    echo -e "${NC}"
    echo -e "${WHITE}Advanced Security Analysis & Threat Investigation${NC}"
    echo -e "${BLUE}Version: $VERSION | Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${BLUE}Host: $(hostname) | User: $(whoami)${NC}"
}

# =============================================================================
# Security Analysis Functions
# =============================================================================

analyze_suspicious_processes() {
    print_section "Detailed Process Analysis"
    
    echo -e "${WHITE}Investigating processes flagged as potentially suspicious:${NC}"
    
    # Get processes that match the suspicious patterns
    local suspicious_patterns=("wget" "curl" "nc" "netcat" "ncat" "socat" "telnet")
    local found_processes=()
    
    for pattern in "${suspicious_patterns[@]}"; do
        local processes=$(ps aux | grep -i "$pattern" | grep -v grep || true)
        if [[ -n "$processes" ]]; then
            found_processes+=("$pattern: $processes")
        fi
    done
    
    if [[ ${#found_processes[@]} -eq 0 ]]; then
        echo -e "${GREEN}✓ No suspicious processes currently running${NC}"
        return 0
    fi
    
    echo -e "\n${YELLOW}Processes found matching suspicious patterns:${NC}"
    
    for process_info in "${found_processes[@]}"; do
        local pattern=$(echo "$process_info" | cut -d: -f1)
        local process_line=$(echo "$process_info" | cut -d: -f2-)
        
        echo -e "\n${WHITE}Pattern: $pattern${NC}"
        echo "$process_line" | while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                local pid=$(echo "$line" | awk '{print $2}')
                local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
                local user=$(echo "$line" | awk '{print $1}')
                
                echo -e "  ${CYAN}PID:${NC} $pid"
                echo -e "  ${CYAN}User:${NC} $user"
                echo -e "  ${CYAN}Command:${NC} $cmd"
                
                # Get additional process information
                if [[ -d "/proc/$pid" ]]; then
                    local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null || echo "Unknown")
                    local cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || echo "Unknown")
                    local exe=$(readlink "/proc/$pid/exe" 2>/dev/null || echo "Unknown")
                    
                    echo -e "  ${CYAN}Started:${NC} $start_time"
                    echo -e "  ${CYAN}Working Dir:${NC} $cwd"
                    echo -e "  ${CYAN}Executable:${NC} $exe"
                    
                    # Check if it's a legitimate system process
                    local legitimacy_score=0
                    local legitimacy_reasons=()
                    
                    # Check common legitimate patterns
                    if [[ "$exe" =~ ^/usr/(bin|sbin)/ ]]; then
                        legitimacy_score=$((legitimacy_score + 3))
                        legitimacy_reasons+=("Located in system directory")
                    fi
                    
                    if [[ "$user" == "root" ]] && [[ "$cmd" =~ containerd|docker|systemd ]]; then
                        legitimacy_score=$((legitimacy_score + 4))
                        legitimacy_reasons+=("System container/service process")
                    fi
                    
                    if [[ "$cmd" =~ postgres|autovacuum ]]; then
                        legitimacy_score=$((legitimacy_score + 4))
                        legitimacy_reasons+=("Database system process")
                    fi
                    
                    if [[ "$start_time" =~ (Jan|Feb|Mar|Apr|May|Jun) ]]; then
                        legitimacy_score=$((legitimacy_score + 2))
                        legitimacy_reasons+=("Long-running system process")
                    fi
                    
                    # Determine threat level
                    local threat_level="HIGH"
                    local threat_color="$RED"
                    
                    if [[ $legitimacy_score -ge 5 ]]; then
                        threat_level="LOW"
                        threat_color="$GREEN"
                    elif [[ $legitimacy_score -ge 3 ]]; then
                        threat_level="MEDIUM"
                        threat_color="$YELLOW"
                    fi
                    
                    echo -e "  ${CYAN}Threat Level:${NC} ${threat_color}$threat_level${NC}"
                    echo -e "  ${CYAN}Legitimacy Score:${NC} $legitimacy_score/10"
                    
                    if [[ ${#legitimacy_reasons[@]} -gt 0 ]]; then
                        echo -e "  ${CYAN}Legitimacy Indicators:${NC}"
                        for reason in "${legitimacy_reasons[@]}"; do
                            echo -e "    • $reason"
                        done
                    fi
                    
                    log_message "INFO" "Process $pid ($pattern) - Threat Level: $threat_level, Score: $legitimacy_score"
                fi
                echo
            fi
        done
    done
}

check_network_connections() {
    print_section "Active Network Connections Analysis"
    
    echo -e "${WHITE}Analyzing active network connections for suspicious activity:${NC}"
    
    # Check for unusual network connections
    echo -e "\n${CYAN}External Connections:${NC}"
    netstat -tuln 2>/dev/null | grep LISTEN | while IFS= read -r line; do
        local proto=$(echo "$line" | awk '{print $1}')
        local local_addr=$(echo "$line" | awk '{print $4}')
        local port=$(echo "$local_addr" | cut -d: -f2)
        
        # Check if port is commonly suspicious
        case "$port" in
            22|80|443|25|587|993|995|3000|8080|8000|5432|27017|6379)
                echo -e "  ${GREEN}✓ $proto $local_addr (Common service port)${NC}"
                ;;
            *)
                echo -e "  ${YELLOW}⚠ $proto $local_addr (Uncommon port - investigate)${NC}"
                ;;
        esac
    done
    
    # Check for established connections to external IPs
    echo -e "\n${CYAN}Established External Connections:${NC}"
    netstat -tun 2>/dev/null | grep ESTABLISHED | grep -v "127.0.0.1\|::1" | head -10 | while IFS= read -r line; do
        local foreign_addr=$(echo "$line" | awk '{print $5}' | cut -d: -f1)
        echo -e "  Connection to: $foreign_addr"
    done
}

check_recent_logins() {
    print_section "Login Activity Analysis"
    
    echo -e "${WHITE}Recent login attempts and user activity:${NC}"
    
    # Check recent successful logins
    echo -e "\n${CYAN}Recent Successful Logins:${NC}"
    last -n 10 2>/dev/null | head -10 || echo "Unable to retrieve login history"
    
    # Check failed login attempts
    echo -e "\n${CYAN}Recent Failed Login Attempts:${NC}"
    if [[ -f "/var/log/auth.log" ]]; then
        grep "Failed password" /var/log/auth.log | tail -5 2>/dev/null || echo "No recent failed attempts found"
    else
        echo "Auth log not accessible"
    fi
    
    # Check for unusual login patterns
    echo -e "\n${CYAN}Login Pattern Analysis:${NC}"
    local current_user=$(whoami)
    local login_count=$(last -n 50 "$current_user" 2>/dev/null | grep -c "$current_user" || echo "0")
    local unique_ips=$(last -n 50 "$current_user" 2>/dev/null | awk '{print $3}' | sort -u | wc -l || echo "0")
    
    echo -e "  Recent logins for $current_user: $login_count"
    echo -e "  Unique IP addresses: $unique_ips"
    
    if [[ $unique_ips -gt 5 ]]; then
        echo -e "  ${YELLOW}⚠ Multiple IP addresses detected - review for suspicious access${NC}"
    else
        echo -e "  ${GREEN}✓ Normal login pattern${NC}"
    fi
}

check_file_integrity() {
    print_section "Critical File Integrity Check"
    
    echo -e "${WHITE}Checking integrity of critical system files:${NC}"
    
    local critical_files=(
        "/etc/passwd"
        "/etc/shadow"
        "/etc/sudoers"
        "/etc/hosts"
        "/etc/crontab"
        "/home/$USER/.bashrc"
        "/home/$USER/.ssh/authorized_keys"
    )
    
    for file in "${critical_files[@]}"; do
        if [[ -f "$file" ]]; then
            local mod_time=$(stat -c "%Y" "$file" 2>/dev/null || echo "0")
            local current_time=$(date +%s)
            local age_days=$(( (current_time - mod_time) / 86400 ))
            
            if [[ $age_days -lt 1 ]]; then
                echo -e "  ${YELLOW}⚠ $file modified within last 24 hours${NC}"
            elif [[ $age_days -lt 7 ]]; then
                echo -e "  ${BLUE}ℹ $file modified within last week${NC}"
            else
                echo -e "  ${GREEN}✓ $file (last modified $age_days days ago)${NC}"
            fi
        else
            echo -e "  ${RED}✗ $file not found${NC}"
        fi
    done
}

check_running_services() {
    print_section "Service and Daemon Analysis"
    
    echo -e "${WHITE}Analyzing running services for suspicious activity:${NC}"
    
    # Check for services running on unusual ports
    echo -e "\n${CYAN}Services Analysis:${NC}"
    systemctl list-units --type=service --state=running --no-legend 2>/dev/null | head -10 | while IFS= read -r line; do
        local service_name=$(echo "$line" | awk '{print $1}')
        echo -e "  ${GREEN}✓ $service_name${NC}"
    done
    
    # Check for failed services that might indicate compromise
    echo -e "\n${CYAN}Failed Services (potential indicators):${NC}"
    local failed_services=$(systemctl list-units --failed --no-legend 2>/dev/null | wc -l)
    if [[ $failed_services -gt 0 ]]; then
        echo -e "  ${YELLOW}⚠ $failed_services failed services detected${NC}"
        systemctl list-units --failed --no-legend 2>/dev/null | head -5
    else
        echo -e "  ${GREEN}✓ No failed services${NC}"
    fi
}

check_system_resources() {
    print_section "Resource Usage Analysis"
    
    echo -e "${WHITE}Analyzing system resources for anomalous usage:${NC}"
    
    # CPU usage analysis
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*}
    
    echo -e "\n${CYAN}CPU Usage Analysis:${NC}"
    if [[ $cpu_usage -gt 80 ]]; then
        echo -e "  ${RED}⚠ High CPU usage detected: ${cpu_usage}%${NC}"
        echo -e "  ${WHITE}Top CPU consumers:${NC}"
        ps aux --sort=-%cpu | head -5 | awk 'NR>1{printf "    %s: %.1f%%\n", $11, $3}'
    else
        echo -e "  ${GREEN}✓ Normal CPU usage: ${cpu_usage}%${NC}"
    fi
    
    # Memory usage analysis
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    echo -e "\n${CYAN}Memory Usage Analysis:${NC}"
    if [[ $mem_usage -gt 85 ]]; then
        echo -e "  ${RED}⚠ High memory usage detected: ${mem_usage}%${NC}"
    else
        echo -e "  ${GREEN}✓ Normal memory usage: ${mem_usage}%${NC}"
    fi
    
    # Disk I/O analysis
    echo -e "\n${CYAN}Disk I/O Analysis:${NC}"
    if command -v iostat &> /dev/null; then
        iostat -x 1 1 2>/dev/null | grep -E "^(Device|[s-z]d)" | tail -5
    else
        echo -e "  ${YELLOW}iostat not available - install sysstat package${NC}"
    fi
}

generate_security_report() {
    print_section "Security Assessment Summary"
    
    echo -e "${WHITE}Overall Security Assessment:${NC}"
    
    local security_score=100
    local issues=()
    local recommendations=()
    
    # Assess various security factors
    local suspicious_processes=$(ps aux | egrep -i "(wget|curl|nc|netcat)" | grep -v grep | wc -l)
    local failed_services=$(systemctl list-units --failed --no-legend 2>/dev/null | wc -l)
    local recent_modifications=$(find /etc -name "passwd" -o -name "shadow" -o -name "sudoers" -mtime -1 2>/dev/null | wc -l)
    
    # Calculate security score
    if [[ $suspicious_processes -gt 5 ]]; then
        security_score=$((security_score - 20))
        issues+=("Multiple processes with network capabilities detected")
        recommendations+=("Review process legitimacy and network connections")
    fi
    
    if [[ $failed_services -gt 0 ]]; then
        security_score=$((security_score - 10))
        issues+=("$failed_services failed system services")
        recommendations+=("Investigate failed services for potential security impact")
    fi
    
    if [[ $recent_modifications -gt 0 ]]; then
        security_score=$((security_score - 30))
        issues+=("Recent modifications to critical system files")
        recommendations+=("Verify legitimacy of recent system file changes")
    fi
    
    # Check for security updates
    if command -v apt &> /dev/null; then
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo "0")
        if [[ $security_updates -gt 0 ]]; then
            security_score=$((security_score - 15))
            issues+=("$security_updates pending security updates")
            recommendations+=("Apply pending security updates immediately")
        fi
    fi
    
    # Determine overall security status
    local security_status="EXCELLENT"
    local status_color="$GREEN"
    
    if [[ $security_score -lt 60 ]]; then
        security_status="CRITICAL"
        status_color="$RED"
    elif [[ $security_score -lt 75 ]]; then
        security_status="WARNING"
        status_color="$YELLOW"
    elif [[ $security_score -lt 90 ]]; then
        security_status="GOOD"
        status_color="$BLUE"
    fi
    
    echo -e "\n${WHITE}🛡️ Security Score: ${status_color}${security_score}/100 ($security_status)${NC}"
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo -e "\n${WHITE}🚨 Issues Identified:${NC}"
        for issue in "${issues[@]}"; do
            echo -e "  ${RED}• $issue${NC}"
        done
    fi
    
    if [[ ${#recommendations[@]} -gt 0 ]]; then
        echo -e "\n${WHITE}💡 Recommendations:${NC}"
        for recommendation in "${recommendations[@]}"; do
            echo -e "  ${YELLOW}• $recommendation${NC}"
        done
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        echo -e "\n${GREEN}✅ No significant security issues detected${NC}"
        echo -e "${GREEN}   System appears to be secure and well-maintained${NC}"
    fi
    
    log_message "INFO" "Security assessment completed - Score: $security_score, Status: $security_status"
}

# =============================================================================
# Main Execution Function
# =============================================================================

main() {
    log_message "INFO" "Starting security investigation"
    
    show_banner
    analyze_suspicious_processes
    check_network_connections
    check_recent_logins
    check_file_integrity
    check_running_services
    check_system_resources
    generate_security_report
    
    print_header "Investigation Complete"
    echo -e "${WHITE}Security investigation completed at: $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${WHITE}Full log available at: $LOG_FILE${NC}"
    echo -e "${BLUE}Run this script regularly to monitor security status${NC}"
    
    log_message "INFO" "Security investigation completed successfully"
}

# =============================================================================
# Script Entry Point
# =============================================================================

# Check for required commands
readonly REQUIRED_COMMANDS=("ps" "netstat" "systemctl" "last")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}Error: Required command '$cmd' not found${NC}" >&2
        exit 1
    fi
done

# Execute main function
main "$@"

exit 0
