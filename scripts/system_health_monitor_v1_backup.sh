#!/bin/bash

# =============================================================================
# System Health Monitor Script
# Gamified Language Learning Platform - Infrastructure Monitoring
# Author: Senior Full Stack Engineer
# Environment: Linux Mint 22 / Ubuntu
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
readonly SCRIPT_NAME="System Health Monitor"
readonly VERSION="1.0.0"
readonly MOCKMAIL_PROCESS_NAMES=("mockmail" "mockmail.dev" "mockmail-server" "mockmail-web")
readonly CPU_THRESHOLD=80
readonly MEMORY_THRESHOLD=85
readonly DISK_THRESHOLD=90

# Logging configuration
readonly LOG_FILE="/var/log/system_health_monitor.log"
readonly MAX_LOG_SIZE=10485760 # 10MB

# =============================================================================
# Utility Functions
# =============================================================================

log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Rotate log if too large
    if [[ -f "$LOG_FILE" ]] && [[ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]]; then
        mv "$LOG_FILE" "${LOG_FILE}.old" 2>/dev/null || true
    fi
    
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
    echo -e "\n${CYAN}📊 $title${NC}"
    echo -e "${CYAN}$(printf '%.0s-' {1..50})${NC}"
}

format_bytes() {
    local bytes=$1
    local units=("B" "KB" "MB" "GB" "TB")
    local unit=0
    
    while [[ $bytes -gt 1024 && $unit -lt 4 ]]; do
        bytes=$((bytes / 1024))
        unit=$((unit + 1))
    done
    
    echo "${bytes}${units[$unit]}"
}

get_status_color() {
    local value=$1
    local threshold=$2
    
    if [[ $value -lt $((threshold - 20)) ]]; then
        echo "$GREEN"
    elif [[ $value -lt $threshold ]]; then
        echo "$YELLOW"
    else
        echo "$RED"
    fi
}

# =============================================================================
# System Information Functions
# =============================================================================

show_banner() {
    clear
    echo -e "${PURPLE}"
    cat << 'BANNER'
 ╔════════════════════════════════════════════════════════════════════════════╗
 ║  ____            _                   _   _            _ _   _               ║
 ║ / ___| _   _ ___| |_ ___ _ __ ___   | | | | ___  __ _| | |_| |__            ║
 ║ \___ \| | | / __| __/ _ \ '_ ` _ \  | |_| |/ _ \/ _` | | __| '_ \           ║
 ║  ___) | |_| \__ \ ||  __/ | | | | | |  _  |  __/ (_| | | |_| | | |          ║
 ║ |____/ \__, |___/\__\___|_| |_| |_| |_| |_|\___|\__,_|_|\__|_| |_|          ║
 ║        |___/                    __  __             _ _             ___      ║
 ║                                |  \/  | ___  _ __ (_) |_ ___  _ __|__ \     ║
 ║                                | |\/| |/ _ \| '_ \| | __/ _ \| '__|/ /      ║
 ║                                | |  | | (_) | | | | | || (_) | |  |_|       ║
 ║                                |_|  |_|\___/|_| |_|_|\__\___/|_|  (_)       ║
 ╚════════════════════════════════════════════════════════════════════════════╝
BANNER
    echo -e "${NC}"
    echo -e "${WHITE}Gamified Language Learning Platform - Infrastructure Monitoring${NC}"
    echo -e "${BLUE}Version: $VERSION | Environment: $(lsb_release -d 2>/dev/null | cut -f2 || echo 'Linux')${NC}"
    echo -e "${BLUE}Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${BLUE}Host: $(hostname) | User: $(whoami)${NC}"
}

get_system_info() {
    print_section "System Information"
    
    local uptime_info=$(uptime | sed 's/.*up \([^,]*\), .*/\1/')
    local kernel_version=$(uname -r)
    local architecture=$(uname -m)
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    
    echo -e "🖥️  ${WHITE}Hostname:${NC} $(hostname)"
    echo -e "⏰ ${WHITE}Uptime:${NC} $uptime_info"
    echo -e "🔧 ${WHITE}Kernel:${NC} $kernel_version"
    echo -e "🏗️  ${WHITE}Architecture:${NC} $architecture"
    echo -e "📈 ${WHITE}Load Average:${NC} $load_avg"
    
    log_message "INFO" "System Info - Uptime: $uptime_info, Kernel: $kernel_version, Load: $load_avg"
}

get_cpu_info() {
    print_section "CPU Information"
    
    local cpu_model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
    local cpu_cores=$(nproc)
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*} # Remove decimal part
    
    local cpu_color=$(get_status_color "$cpu_usage" "$CPU_THRESHOLD")
    
    echo -e "🔲 ${WHITE}Model:${NC} $cpu_model"
    echo -e "⚙️  ${WHITE}Cores:${NC} $cpu_cores"
    echo -e "📊 ${WHITE}Usage:${NC} ${cpu_color}${cpu_usage}%${NC}"
    
    # CPU per core usage
    echo -e "\n${WHITE}Per-Core Usage:${NC}"
    mpstat -P ALL 1 1 | grep -E "Average.*[0-9]" | awk '{printf "  Core %s: %.1f%%\n", $2, 100-$12}' 2>/dev/null || echo "  mpstat not available"
    
    log_message "INFO" "CPU Info - Model: $cpu_model, Cores: $cpu_cores, Usage: ${cpu_usage}%"
}

get_memory_info() {
    print_section "Memory Information"
    
    local mem_info=$(free -h)
    local mem_usage_percent=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local mem_color=$(get_status_color "$mem_usage_percent" "$MEMORY_THRESHOLD")
    
    echo -e "${WHITE}Memory Usage:${NC}"
    echo "$mem_info" | awk '
    NR==1 {printf "  %-10s %10s %10s %10s %10s %10s\n", $1, $2, $3, $4, $5, $6}
    NR==2 {printf "  %-10s %10s %10s %10s %10s %10s\n", $1, $2, $3, $4, $5, $6}
    NR==3 {printf "  %-10s %10s %10s\n", $1, $2, $3}
    '
    
    echo -e "\n📊 ${WHITE}Memory Usage:${NC} ${mem_color}${mem_usage_percent}%${NC}"
    
    # Show swap usage
    local swap_usage=$(free | awk 'NR==3 && $2>0 {printf "%.0f", $3*100/$2}')
    if [[ -n "$swap_usage" && "$swap_usage" != "0" ]]; then
        echo -e "🔄 ${WHITE}Swap Usage:${NC} ${swap_usage}%"
    fi
    
    log_message "INFO" "Memory Usage: ${mem_usage_percent}%"
}

get_disk_info() {
    print_section "Disk Information"
    
    echo -e "${WHITE}Filesystem Usage:${NC}"
    df -h | awk '
    NR==1 {printf "  %-20s %8s %8s %8s %5s %s\n", $1, $2, $3, $4, $5, $6}
    NR>1 && $5+0 > 0 {printf "  %-20s %8s %8s %8s %5s %s\n", $1, $2, $3, $4, $5, $6}
    '
    
    # Check critical disk usage
    echo -e "\n${WHITE}Critical Disk Usage (>80%):${NC}"
    local critical_disks=$(df -h | awk 'NR>1 && substr($5,1,length($5)-1)+0 > 80 {print "  " $6 ": " $5}')
    if [[ -n "$critical_disks" ]]; then
        echo -e "${RED}$critical_disks${NC}"
    else
        echo -e "${GREEN}  No critical disk usage detected${NC}"
    fi
    
    log_message "INFO" "Disk usage checked"
}

get_network_info() {
    print_section "Network Information"
    
    echo -e "${WHITE}Network Interfaces:${NC}"
    ip -4 addr show | grep -E "inet|^\d+:" | awk '
    /^[0-9]+:/ {iface=$2; gsub(/:/, "", iface)}
    /inet/ && !/127\.0\.0\.1/ {printf "  %-10s %s\n", iface, $2}
    '
    
    # Network statistics
    echo -e "\n${WHITE}Network Statistics:${NC}"
    cat /proc/net/dev | awk '
    NR>2 && $2>0 {
        printf "  %-10s RX: %10d bytes TX: %10d bytes\n", 
        substr($1,1,length($1)-1), $2, $10
    }'
    
    # Check internet connectivity
    echo -e "\n${WHITE}Connectivity Test:${NC}"
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Internet connectivity: OK${NC}"
    else
        echo -e "  ${RED}✗ Internet connectivity: FAILED${NC}"
    fi
}

get_top_processes() {
    print_section "Top Resource Consuming Processes"
    
    echo -e "${WHITE}Top 10 CPU Consuming Processes:${NC}"
    ps aux --sort=-%cpu | head -11 | awk '
    NR==1 {printf "  %-12s %5s %5s %8s %s\n", $1, "%CPU", "%MEM", "RSS", "COMMAND"}
    NR>1 {printf "  %-12s %5.1f %5.1f %8s %s\n", $1, $3, $4, $6, substr($11,1,50)}
    '
    
    echo -e "\n${WHITE}Top 10 Memory Consuming Processes:${NC}"
    ps aux --sort=-%mem | head -11 | awk '
    NR==1 {printf "  %-12s %5s %5s %8s %s\n", $1, "%CPU", "%MEM", "RSS", "COMMAND"}
    NR>1 {printf "  %-12s %5.1f %5.1f %8s %s\n", $1, $3, $4, $6, substr($11,1,50)}
    '
    
    log_message "INFO" "Process information collected"
}

check_mockmail_application() {
    print_section "MockMail.dev Application Status"
    
    local mockmail_found=false
    local mockmail_processes=()
    
    # Check for MockMail processes
    for process_name in "${MOCKMAIL_PROCESS_NAMES[@]}"; do
        local processes=$(pgrep -f "$process_name" 2>/dev/null || true)
        if [[ -n "$processes" ]]; then
            mockmail_found=true
            while IFS= read -r pid; do
                if [[ -n "$pid" ]]; then
                    local process_info=$(ps -p "$pid" -o pid,ppid,%cpu,%mem,etime,cmd --no-headers 2>/dev/null || true)
                    if [[ -n "$process_info" ]]; then
                        mockmail_processes+=("$process_info")
                    fi
                fi
            done <<< "$processes"
        fi
    done
    
    if [[ "$mockmail_found" == true ]]; then
        echo -e "${GREEN}✓ MockMail.dev processes found${NC}"
        echo -e "\n${WHITE}Active MockMail Processes:${NC}"
        printf "  %-8s %-8s %-6s %-6s %-10s %s\n" "PID" "PPID" "%CPU" "%MEM" "ETIME" "COMMAND"
        for process in "${mockmail_processes[@]}"; do
            echo "  $process"
        done
        
        # Check ports (common web/mail ports)
        echo -e "\n${WHITE}Port Status:${NC}"
        local ports=("80" "443" "25" "587" "993" "995" "3000" "8080" "8000")
        for port in "${ports[@]}"; do
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                echo -e "  ${GREEN}✓ Port $port: LISTENING${NC}"
            fi
        done
        
        # Check log files (common locations)
        echo -e "\n${WHITE}Log Files:${NC}"
        local log_locations=("/var/log/mockmail" "/var/log/mockmail.dev" "/tmp/mockmail" "./logs" "/home/$(whoami)/mockmail/logs")
        for log_dir in "${log_locations[@]}"; do
            if [[ -d "$log_dir" ]]; then
                local log_count=$(find "$log_dir" -name "*.log" 2>/dev/null | wc -l)
                echo -e "  ${GREEN}✓ Found $log_count log files in $log_dir${NC}"
            fi
        done
        
        log_message "INFO" "MockMail.dev application is running with ${#mockmail_processes[@]} processes"
    else
        echo -e "${RED}✗ No MockMail.dev processes found${NC}"
        echo -e "${YELLOW}  Searching for related processes...${NC}"
        
        # Search for any mail-related processes
        local mail_processes=$(ps aux | grep -iE "(mail|smtp|imap|pop)" | grep -v grep || true)
        if [[ -n "$mail_processes" ]]; then
            echo -e "${WHITE}Related processes found:${NC}"
            echo "$mail_processes" | head -5
        else
            echo -e "${YELLOW}  No mail-related processes found${NC}"
        fi
        
        log_message "WARNING" "MockMail.dev application not found"
    fi
    
    # Check for Docker containers (in case MockMail runs in Docker)
    if command -v docker &> /dev/null; then
        echo -e "\n${WHITE}Docker Containers:${NC}"
        local docker_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -i mockmail || true)
        if [[ -n "$docker_containers" ]]; then
            echo -e "${GREEN}MockMail Docker containers:${NC}"
            echo "$docker_containers"
        else
            echo -e "${YELLOW}  No MockMail Docker containers found${NC}"
        fi
    fi
}

get_system_services() {
    print_section "System Services Status"
    
    local critical_services=("ssh" "networking" "cron" "rsyslog")
    
    echo -e "${WHITE}Critical Services:${NC}"
    for service in "${critical_services[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo -e "  ${GREEN}✓ $service: ACTIVE${NC}"
        else
            echo -e "  ${RED}✗ $service: INACTIVE${NC}"
        fi
    done
    
    # Show failed services
    echo -e "\n${WHITE}Failed Services:${NC}"
    local failed_services=$(systemctl list-units --failed --no-legend 2>/dev/null | awk '{print $1}' || true)
    if [[ -n "$failed_services" ]]; then
        echo -e "${RED}$failed_services${NC}"
    else
        echo -e "${GREEN}  No failed services${NC}"
    fi
}

show_security_status() {
    print_section "Security Status"
    
    # Check for security updates
    echo -e "${WHITE}Security Updates:${NC}"
    if command -v apt &> /dev/null; then
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo "0")
        if [[ "$security_updates" -gt 0 ]]; then
            echo -e "  ${YELLOW}⚠️ $security_updates security updates available${NC}"
        else
            echo -e "  ${GREEN}✓ No security updates pending${NC}"
        fi
    fi
    
    # Check last login attempts
    echo -e "\n${WHITE}Recent Login Attempts:${NC}"
    last -n 5 2>/dev/null | head -5 || echo "  Unable to retrieve login history"
    
    # Check for suspicious processes
    echo -e "\n${WHITE}Suspicious Activity Check:${NC}"
    local suspicious_processes=$(ps aux | egrep -i "(wget|curl|nc|netcat)" | grep -v grep | wc -l || echo "0")
    if [[ "$suspicious_processes" -gt 0 ]]; then
        echo -e "  ${YELLOW}⚠️ $suspicious_processes potentially suspicious processes found${NC}"
    else
        echo -e "  ${GREEN}✓ No suspicious processes detected${NC}"
    fi
}

generate_summary() {
    print_section "Health Summary"
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*}
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local disk_usage=$(df / | awk 'NR==2{print substr($5,1,length($5)-1)}')
    
    echo -e "${WHITE}Overall System Health:${NC}"
    
    # CPU Status
    local cpu_color=$(get_status_color "$cpu_usage" "$CPU_THRESHOLD")
    local cpu_status="GOOD"
    [[ $cpu_usage -gt $CPU_THRESHOLD ]] && cpu_status="HIGH"
    echo -e "  🔲 CPU: ${cpu_color}${cpu_usage}% ($cpu_status)${NC}"
    
    # Memory Status
    local mem_color=$(get_status_color "$mem_usage" "$MEMORY_THRESHOLD")
    local mem_status="GOOD"
    [[ $mem_usage -gt $MEMORY_THRESHOLD ]] && mem_status="HIGH"
    echo -e "  🧠 Memory: ${mem_color}${mem_usage}% ($mem_status)${NC}"
    
    # Disk Status
    local disk_color=$(get_status_color "$disk_usage" "$DISK_THRESHOLD")
    local disk_status="GOOD"
    [[ $disk_usage -gt $DISK_THRESHOLD ]] && disk_status="HIGH"
    echo -e "  💾 Disk: ${disk_color}${disk_usage}% ($disk_status)${NC}"
    
    # Overall health score
    local health_score=100
    [[ $cpu_usage -gt $CPU_THRESHOLD ]] && health_score=$((health_score - 30))
    [[ $mem_usage -gt $MEMORY_THRESHOLD ]] && health_score=$((health_score - 30))
    [[ $disk_usage -gt $DISK_THRESHOLD ]] && health_score=$((health_score - 40))
    
    local health_color="$GREEN"
    local health_status="EXCELLENT"
    if [[ $health_score -lt 70 ]]; then
        health_color="$RED"
        health_status="CRITICAL"
    elif [[ $health_score -lt 85 ]]; then
        health_color="$YELLOW"
        health_status="WARNING"
    fi
    
    echo -e "\n${WHITE}🏥 Overall Health Score: ${health_color}${health_score}/100 ($health_status)${NC}"
    
    log_message "INFO" "Health Summary - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%, Score: ${health_score}/100"
}

show_recommendations() {
    print_section "Recommendations"
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*}
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local disk_usage=$(df / | awk 'NR==2{print substr($5,1,length($5)-1)}')
    
    local recommendations=()
    
    if [[ $cpu_usage -gt $CPU_THRESHOLD ]]; then
        recommendations+=("🔲 High CPU usage detected - consider identifying and optimizing resource-intensive processes")
    fi
    
    if [[ $mem_usage -gt $MEMORY_THRESHOLD ]]; then
        recommendations+=("🧠 High memory usage - consider clearing caches or adding more RAM")
    fi
    
    if [[ $disk_usage -gt $DISK_THRESHOLD ]]; then
        recommendations+=("💾 High disk usage - clean up temporary files and logs")
    fi
    
    # Security recommendations
    if command -v apt &> /dev/null; then
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo "0")
        if [[ "$security_updates" -gt 0 ]]; then
            recommendations+=("🔒 Apply $security_updates pending security updates")
        fi
    fi
    
    if [[ ${#recommendations[@]} -eq 0 ]]; then
        echo -e "${GREEN}✓ System is running optimally - no immediate actions required${NC}"
        echo -e "  • Continue monitoring system performance"
        echo -e "  • Ensure MockMail.dev application is functioning correctly"
        echo -e "  • Consider scheduling regular maintenance tasks"
    else
        echo -e "${YELLOW}Recommended Actions:${NC}"
        for recommendation in "${recommendations[@]}"; do
            echo -e "  $recommendation"
        done
    fi
}

# =============================================================================
# Main Execution Function
# =============================================================================

main() {
    # Ensure we have necessary permissions for system information
    if [[ $EUID -eq 0 ]]; then
        log_message "INFO" "Running with root privileges"
    else
        log_message "INFO" "Running with user privileges - some information may be limited"
    fi
    
    # Create log directory if it doesn't exist
    local log_dir=$(dirname "$LOG_FILE")
    [[ ! -d "$log_dir" ]] && sudo mkdir -p "$log_dir" 2>/dev/null || true
    
    log_message "INFO" "Starting system health monitoring session"
    
    # Execute monitoring functions
    show_banner
    get_system_info
    get_cpu_info
    get_memory_info
    get_disk_info
    get_network_info
    get_top_processes
    check_mockmail_application
    get_system_services
    show_security_status
    generate_summary
    show_recommendations
    
    # Footer
    print_header "Monitoring Complete"
    echo -e "${WHITE}Report generated at: $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${WHITE}Log file: $LOG_FILE${NC}"
    echo -e "${BLUE}Next recommended check: $(date -d '+1 hour' '+%Y-%m-%d %H:%M:%S')${NC}"
    
    log_message "INFO" "System health monitoring session completed successfully"
}

# =============================================================================
# Script Entry Point
# =============================================================================

# Trap signals for graceful shutdown
trap 'log_message "INFO" "Script interrupted by user"; exit 1' INT TERM

# Check for required commands
readonly REQUIRED_COMMANDS=("ps" "free" "df" "uptime" "top" "netstat")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}Error: Required command '$cmd' not found${NC}" >&2
        exit 1
    fi
done

# Execute main function
main "$@"

# Exit successfully
exit 0
