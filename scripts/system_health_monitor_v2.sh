#!/bin/bash

# =============================================================================
# System Health Monitor v2.0 - Enhanced MockMail.dev Edition
# Specialized monitoring for MockMail.dev application and integrators
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
readonly SCRIPT_NAME="System Health Monitor v2.0"
readonly VERSION="2.0.0"
readonly MOCKMAIL_BASE_PATH="/opt/mockmail"
readonly MOCKMAIL_API_PATH="/opt/mockmail-api"
readonly MOCKMAIL_LOG_PATH="/var/log/mockmail"
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

show_banner() {
    clear
    echo -e "${PURPLE}"
    cat << 'BANNER'
 ╔════════════════════════════════════════════════════════════════════════════╗
 ║  __  __            _    __  __       _ _       _            ____           ║
 ║ |  \/  | ___   ___| | _|  \/  | __ _(_) |   __| | _____   _|___ \          ║
 ║ | |\/| |/ _ \ / __| |/ / |\/| |/ _` | | |  / _` |/ _ \ \ / / __) |         ║
 ║ | |  | | (_) | (__|   <| |  | | (_| | | | | (_| |  __/\ V / / __/          ║
 ║ |_|  |_|\___/ \___|_|\_\_|  |_|\__,_|_|_|(_)__,_|\___| \_(_)_____|         ║
 ║                                                                            ║
 ║              🏥 Enhanced System Health Monitor v2.0 🏥                    ║
 ╚════════════════════════════════════════════════════════════════════════════╝
BANNER
    echo -e "${NC}"
    echo -e "${WHITE}MockMail.dev Platform - Advanced Infrastructure Monitoring${NC}"
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
    cpu_usage=${cpu_usage%.*}
    
    local cpu_color=$(get_status_color "$cpu_usage" "$CPU_THRESHOLD")
    
    echo -e "🔲 ${WHITE}Model:${NC} $cpu_model"
    echo -e "⚙️  ${WHITE}Cores:${NC} $cpu_cores"
    echo -e "📊 ${WHITE}Usage:${NC} ${cpu_color}${cpu_usage}%${NC}"
    
    # CPU per core usage
    if command -v mpstat &> /dev/null; then
        echo -e "\n${WHITE}Per-Core Usage:${NC}"
        mpstat -P ALL 1 1 | grep -E "Average.*[0-9]" | awk '{printf "  Core %s: %.1f%%\n", $2, 100-$12}' 2>/dev/null || echo "  Individual core data unavailable"
    fi
    
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
    
    echo -e "${WHITE}🚀 MockMail.dev Core Application Analysis${NC}"
    
    # Check MockMail main application
    local mockmail_process=$(ps aux | grep "/opt/mockmail.*python.*email_processor.py" | grep -v grep || true)
    
    if [[ -n "$mockmail_process" ]]; then
        echo -e "${GREEN}✓ MockMail.dev Core Application: RUNNING${NC}"
        
        local pid=$(echo "$mockmail_process" | awk '{print $2}')
        local cpu_usage=$(echo "$mockmail_process" | awk '{print $3}')
        local mem_usage=$(echo "$mockmail_process" | awk '{print $4}')
        local start_time=$(ps -o lstart= -p "$pid" 2>/dev/null || echo "Unknown")
        local user=$(echo "$mockmail_process" | awk '{print $1}')
        
        echo -e "\n${WHITE}📋 Application Details:${NC}"
        echo -e "  ${CYAN}PID:${NC} $pid"
        echo -e "  ${CYAN}User:${NC} $user"
        echo -e "  ${CYAN}CPU Usage:${NC} ${cpu_usage}%"
        echo -e "  ${CYAN}Memory Usage:${NC} ${mem_usage}%"
        echo -e "  ${CYAN}Started:${NC} $start_time"
        echo -e "  ${CYAN}Executable:${NC} /opt/mockmail/email_processor.py"
        
        # Check application files
        echo -e "\n${WHITE}📁 Application Files Status:${NC}"
        if [[ -f "$MOCKMAIL_BASE_PATH/email_processor.py" ]]; then
            local file_size=$(ls -lh "$MOCKMAIL_BASE_PATH/email_processor.py" | awk '{print $5}')
            local file_mod=$(stat -c "%y" "$MOCKMAIL_BASE_PATH/email_processor.py" | cut -d' ' -f1)
            echo -e "  ${GREEN}✓ Main Script: $file_size (modified: $file_mod)${NC}"
        else
            echo -e "  ${RED}✗ Main Script: NOT FOUND${NC}"
        fi
        
        if [[ -d "$MOCKMAIL_BASE_PATH/venv" ]]; then
            echo -e "  ${GREEN}✓ Virtual Environment: EXISTS${NC}"
        else
            echo -e "  ${YELLOW}⚠ Virtual Environment: NOT FOUND${NC}"
        fi
        
        log_message "INFO" "MockMail.dev core application is running - PID: $pid"
    else
        echo -e "${RED}✗ MockMail.dev Core Application: NOT RUNNING${NC}"
        log_message "WARNING" "MockMail.dev core application not found"
    fi
    
    # Check MockMail API
    echo -e "\n${WHITE}🔌 MockMail API Status:${NC}"
    if [[ -d "$MOCKMAIL_API_PATH" ]]; then
        echo -e "  ${GREEN}✓ API Directory: EXISTS${NC}"
        local api_files=$(find "$MOCKMAIL_API_PATH" -name "*.py" -o -name "*.js" -o -name "*.json" 2>/dev/null | wc -l)
        echo -e "  ${BLUE}ℹ API Files: $api_files files found${NC}"
    else
        echo -e "  ${YELLOW}⚠ API Directory: NOT FOUND${NC}"
    fi
    
    # Check log files
    echo -e "\n${WHITE}📝 Log Files Analysis:${NC}"
    local log_locations=("/var/log/mockmail" "/opt/mockmail" "/tmp/mockmail" "./logs")
    local total_logs=0
    
    for log_dir in "${log_locations[@]}"; do
        if [[ -d "$log_dir" ]]; then
            local log_count=$(find "$log_dir" -name "*.log" 2>/dev/null | wc -l)
            if [[ $log_count -gt 0 ]]; then
                echo -e "  ${GREEN}✓ Found $log_count log files in $log_dir${NC}"
                total_logs=$((total_logs + log_count))
                
                # Show recent log activity
                local recent_logs=$(find "$log_dir" -name "*.log" -mtime -1 2>/dev/null | wc -l)
                if [[ $recent_logs -gt 0 ]]; then
                    echo -e "    ${BLUE}ℹ $recent_logs logs updated in last 24h${NC}"
                fi
            fi
        fi
    done
    
    if [[ $total_logs -eq 0 ]]; then
        echo -e "  ${YELLOW}⚠ No log files found in common locations${NC}"
    fi
    
    # Check service ports
    echo -e "\n${WHITE}🌐 Service Ports Status:${NC}"
    local mockmail_ports=("25" "80" "443" "587" "993" "995" "110" "143")
    local active_ports=0
    
    for port in "${mockmail_ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "  ${GREEN}✓ Port $port: LISTENING${NC}"
            active_ports=$((active_ports + 1))
        fi
    done
    
    if [[ $active_ports -eq 0 ]]; then
        echo -e "  ${YELLOW}⚠ No standard mail ports found listening${NC}"
    else
        echo -e "  ${BLUE}ℹ Total active mail ports: $active_ports${NC}"
    fi
}

check_docker_integrators() {
    print_section "Docker Integration Services"
    
    echo -e "${WHITE}🐳 Docker Container Analysis (Integration Services)${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not available${NC}"
        return 1
    fi
    
    # Get running containers
    local containers=$(docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "")
    
    if [[ -n "$containers" ]] && [[ "$containers" != "NAMES	IMAGE	STATUS	PORTS" ]]; then
        echo -e "${GREEN}✓ Integration Containers Running${NC}"
        echo -e "\n${WHITE}📋 Container Details:${NC}"
        echo "$containers" | awk '
        NR==1 {printf "  %-15s %-20s %-15s %s\n", $1, $2, $3, $4}
        NR>1 {printf "  %-15s %-20s %-15s %s\n", $1, $2, $3, $4}
        '
        
        # Analyze specific containers
        echo -e "\n${WHITE}🔍 Integration Services Analysis:${NC}"
        
        # Check N8N (workflow automation)
        if docker ps --format "{{.Names}}" | grep -q "n8n"; then
            echo -e "  ${GREEN}✓ N8N Workflow Engine: RUNNING${NC}"
            local n8n_port=$(docker ps --format "{{.Names}}\t{{.Ports}}" | grep n8n | cut -f2 | grep -o "5678")
            if [[ -n "$n8n_port" ]]; then
                echo -e "    ${BLUE}ℹ Access URL: http://$(hostname):5678${NC}"
            fi
        fi
        
        # Check PostgreSQL
        if docker ps --format "{{.Names}}" | grep -q "postgres"; then
            echo -e "  ${GREEN}✓ PostgreSQL Database: RUNNING${NC}"
            echo -e "    ${BLUE}ℹ Used for N8N workflow storage${NC}"
        fi
        
        # Check MongoDB
        if docker ps --format "{{.Names}}" | grep -q "mongo"; then
            echo -e "  ${GREEN}✓ MongoDB Database: RUNNING${NC}"
            echo -e "    ${BLUE}ℹ Used for data storage and caching${NC}"
        fi
        
        # Container resource usage
        echo -e "\n${WHITE}📊 Container Resource Usage:${NC}"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | awk '
        NR==1 {printf "  %-15s %-10s %s\n", $1, $2, $3}
        NR>1 {printf "  %-15s %-10s %s\n", $1, $2, $3}
        ' || echo "  ${YELLOW}⚠ Resource stats unavailable${NC}"
        
        local container_count=$(docker ps --format "{{.Names}}" | wc -l)
        log_message "INFO" "Docker integration services running - $container_count containers active"
    else
        echo -e "${YELLOW}⚠ No integration containers currently running${NC}"
        echo -e "  ${BLUE}ℹ This may be normal if integrations are not needed${NC}"
        log_message "INFO" "No Docker containers running"
    fi
    
    # Check Docker system status
    echo -e "\n${WHITE}🔧 Docker System Status:${NC}"
    local docker_version=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "Unknown")
    echo -e "  ${BLUE}ℹ Docker Version: $docker_version${NC}"
    
    local docker_space=$(docker system df --format "table {{.Type}}\t{{.Size}}" 2>/dev/null | tail -n +2 | awk '{sum += $2} END {print sum}' || echo "0")
    if [[ "$docker_space" != "0" ]]; then
        echo -e "  ${BLUE}ℹ Docker Disk Usage: ${docker_space}${NC}"
    fi
}

check_system_services() {
    print_section "System Services Status"
    
    local critical_services=("ssh" "cron" "rsyslog" "haproxy" "dovecot" "fail2ban")
    
    echo -e "${WHITE}Critical Services:${NC}"
    for service in "${critical_services[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo -e "  ${GREEN}✓ $service: ACTIVE${NC}"
        else
            if systemctl list-units --all | grep -q "$service.service"; then
                echo -e "  ${RED}✗ $service: INACTIVE${NC}"
            else
                echo -e "  ${BLUE}ℹ $service: NOT INSTALLED${NC}"
            fi
        fi
    done
    
    # Show failed services
    echo -e "\n${WHITE}Failed Services:${NC}"
    local failed_services=$(systemctl list-units --failed --no-legend 2>/dev/null | head -5 || true)
    if [[ -n "$failed_services" ]]; then
        echo -e "${YELLOW}Recent failures:${NC}"
        echo "$failed_services" | while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                local service_name=$(echo "$line" | awk '{print $1}')
                echo -e "  ${YELLOW}⚠ $service_name${NC}"
            fi
        done
    else
        echo -e "${GREEN}  No failed services${NC}"
    fi
}

show_security_status() {
    print_section "Security Status"
    
    # Enhanced security analysis with proper process filtering
    echo -e "${WHITE}Process Security Analysis:${NC}"
    local suspicious_count=0
    local legitimate_count=0
    
    # Check for legitimate processes that might trigger false positives
    local patterns=("curl" "wget" "nc" "netcat")
    
    for pattern in "${patterns[@]}"; do
        local processes=$(ps aux | grep -i "$pattern" | grep -v grep || true)
        if [[ -n "$processes" ]]; then
            echo "$processes" | while IFS= read -r line; do
                if [[ -n "$line" ]]; then
                    local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
                    
                    # Smart legitimacy detection
                    if [[ "$cmd" =~ (containerd|docker|systemd|postgres|autovacuum|launcher|timesyncd) ]]; then
                        legitimate_count=$((legitimate_count + 1))
                        echo -e "  ${GREEN}✓ Legitimate system process: $(echo "$cmd" | cut -c1-60)...${NC}"
                    elif [[ "$cmd" =~ ^/usr/(bin|sbin)/ ]]; then
                        legitimate_count=$((legitimate_count + 1))
                        echo -e "  ${GREEN}✓ System binary: $(echo "$cmd" | cut -c1-60)...${NC}"
                    else
                        suspicious_count=$((suspicious_count + 1))
                        echo -e "  ${YELLOW}⚠ Review needed: $(echo "$cmd" | cut -c1-60)...${NC}"
                    fi
                fi
            done
        fi
    done
    
    if [[ $suspicious_count -eq 0 ]]; then
        echo -e "\n${GREEN}✅ No suspicious processes detected${NC}"
    else
        echo -e "\n${YELLOW}⚠️ $suspicious_count processes may need review${NC}"
    fi
    
    # Check for security updates
    echo -e "\n${WHITE}Security Updates:${NC}"
    if command -v apt &> /dev/null; then
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo "0")
        if [[ $security_updates -gt 0 ]]; then
            echo -e "  ${YELLOW}⚠️ $security_updates security updates available${NC}"
        else
            echo -e "  ${GREEN}✓ No security updates pending${NC}"
        fi
    fi
    
    # Check recent login attempts
    echo -e "\n${WHITE}Recent Access Analysis:${NC}"
    local current_users=$(who | wc -l)
    echo -e "  ${BLUE}ℹ Current active sessions: $current_users${NC}"
    
    # Check for failed login attempts (last 10)
    if [[ -f "/var/log/auth.log" ]]; then
        local failed_attempts=$(grep "Failed password" /var/log/auth.log | tail -10 | wc -l 2>/dev/null || echo "0")
        if [[ $failed_attempts -gt 0 ]]; then
            echo -e "  ${YELLOW}⚠️ $failed_attempts recent failed login attempts${NC}"
            echo -e "    ${BLUE}ℹ This is normal for internet-facing servers${NC}"
        else
            echo -e "  ${GREEN}✓ No recent failed login attempts${NC}"
        fi
    fi
}

generate_summary() {
    print_section "System Health Summary"
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*}
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local disk_usage=$(df / | awk 'NR==2{print substr($5,1,length($5)-1)}')
    
    echo -e "${WHITE}📊 Overall System Health:${NC}"
    
    # CPU Status
    local cpu_color=$(get_status_color "$cpu_usage" "$CPU_THRESHOLD")
    local cpu_status="EXCELLENT"
    [[ $cpu_usage -gt $((CPU_THRESHOLD - 20)) ]] && cpu_status="GOOD"
    [[ $cpu_usage -gt $CPU_THRESHOLD ]] && cpu_status="HIGH"
    echo -e "  🔲 CPU: ${cpu_color}${cpu_usage}% ($cpu_status)${NC}"
    
    # Memory Status
    local mem_color=$(get_status_color "$mem_usage" "$MEMORY_THRESHOLD")
    local mem_status="EXCELLENT"
    [[ $mem_usage -gt $((MEMORY_THRESHOLD - 20)) ]] && mem_status="GOOD"
    [[ $mem_usage -gt $MEMORY_THRESHOLD ]] && mem_status="HIGH"
    echo -e "  🧠 Memory: ${mem_color}${mem_usage}% ($mem_status)${NC}"
    
    # Disk Status
    local disk_color=$(get_status_color "$disk_usage" "$DISK_THRESHOLD")
    local disk_status="EXCELLENT"
    [[ $disk_usage -gt $((DISK_THRESHOLD - 20)) ]] && disk_status="GOOD"
    [[ $disk_usage -gt $DISK_THRESHOLD ]] && disk_status="HIGH"
    echo -e "  💾 Disk: ${disk_color}${disk_usage}% ($disk_status)${NC}"
    
    # MockMail Status
    echo -e "\n${WHITE}🚀 MockMail.dev Platform Status:${NC}"
    if ps aux | grep "/opt/mockmail.*python.*email_processor.py" | grep -v grep >/dev/null; then
        echo -e "  📧 Core Application: ${GREEN}RUNNING${NC}"
    else
        echo -e "  📧 Core Application: ${RED}STOPPED${NC}"
    fi
    
    if command -v docker &> /dev/null && docker ps --format "{{.Names}}" | head -1 >/dev/null 2>&1; then
        local container_count=$(docker ps --format "{{.Names}}" | wc -l)
        echo -e "  🐳 Integration Services: ${GREEN}$container_count ACTIVE${NC}"
    else
        echo -e "  🐳 Integration Services: ${YELLOW}NONE RUNNING${NC}"
    fi
    
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
    elif [[ $health_score -lt 95 ]]; then
        health_color="$BLUE"
        health_status="GOOD"
    fi
    
    echo -e "\n${WHITE}🏥 Overall System Health: ${health_color}${health_score}/100 ($health_status)${NC}"
    
    log_message "INFO" "Health Summary - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%, Score: ${health_score}/100"
}

show_recommendations() {
    print_section "Intelligent Recommendations"
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_usage=${cpu_usage%.*}
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local disk_usage=$(df / | awk 'NR==2{print substr($5,1,length($5)-1)}')
    
    local recommendations=()
    
    # Performance recommendations
    if [[ $cpu_usage -gt $CPU_THRESHOLD ]]; then
        recommendations+=("🔲 Investigate high CPU usage - check MockMail processing load")
    fi
    
    if [[ $mem_usage -gt $MEMORY_THRESHOLD ]]; then
        recommendations+=("🧠 Monitor memory usage - consider scaling Docker containers")
    fi
    
    if [[ $disk_usage -gt $DISK_THRESHOLD ]]; then
        recommendations+=("💾 Disk cleanup needed - check log files and container images")
    fi
    
    # MockMail specific recommendations
    if ! ps aux | grep "/opt/mockmail.*python.*email_processor.py" | grep -v grep >/dev/null; then
        recommendations+=("📧 MockMail core application is not running - investigate startup issues")
    fi
    
    # Security recommendations
    if command -v apt &> /dev/null; then
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo "0")
        if [[ $security_updates -gt 0 ]]; then
            recommendations+=("🔒 Apply $security_updates pending security updates")
        fi
    fi
    
    # Docker recommendations
    if command -v docker &> /dev/null; then
        local stopped_containers=$(docker ps -a --filter "status=exited" --format "{{.Names}}" | wc -l)
        if [[ $stopped_containers -gt 0 ]]; then
            recommendations+=("🐳 Clean up $stopped_containers stopped Docker containers")
        fi
    fi
    
    if [[ ${#recommendations[@]} -eq 0 ]]; then
        echo -e "${GREEN}✅ System is running optimally${NC}"
        echo -e "\n${WHITE}✨ Optimization Suggestions:${NC}"
        echo -e "  • Continue regular monitoring with this enhanced script"
        echo -e "  • Consider automated health checks via cron job"
        echo -e "  • Monitor MockMail.dev logs for application-specific insights"
        echo -e "  • Review integration container performance weekly"
    else
        echo -e "${WHITE}📋 Recommended Actions:${NC}"
        for recommendation in "${recommendations[@]}"; do
            echo -e "  $recommendation"
        done
    fi
    
    echo -e "\n${WHITE}🔄 Maintenance Schedule Suggestions:${NC}"
    echo -e "  • ${BLUE}Daily:${NC} Run this health monitor"
    echo -e "  • ${BLUE}Weekly:${NC} Review logs and update Docker images"
    echo -e "  • ${BLUE}Monthly:${NC} Apply security updates and cleanup disk space"
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
    
    log_message "INFO" "Starting enhanced system health monitoring session"
    
    # Execute monitoring functions
    show_banner
    get_system_info
    get_cpu_info
    get_memory_info
    get_disk_info
    get_network_info
    get_top_processes
    check_mockmail_application
    check_docker_integrators
    check_system_services
    show_security_status
    generate_summary
    show_recommendations
    
    # Footer
    print_header "Enhanced Monitoring Complete"
    echo -e "${WHITE}🎯 MockMail.dev Platform Health Report Generated${NC}"
    echo -e "${WHITE}📅 Report generated at: $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo -e "${WHITE}📝 Detailed log: $LOG_FILE${NC}"
    echo -e "${BLUE}🔄 Next recommended check: $(date -d '+1 hour' '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}💡 For real-time monitoring: watch -n 30 '$0'${NC}"
    
    log_message "INFO" "Enhanced system health monitoring session completed successfully"
}

# =============================================================================
# Script Entry Point
# =============================================================================

# Trap signals for graceful shutdown
trap 'log_message "INFO" "Script interrupted by user"; exit 1' INT TERM

# Check for required commands
readonly REQUIRED_COMMANDS=("ps" "free" "df" "uptime" "top" "netstat" "docker")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$cmd" &> /dev/null && [[ "$cmd" != "docker" ]]; then
        echo -e "${RED}Error: Required command '$cmd' not found${NC}" >&2
        exit 1
    fi
done

# Execute main function
main "$@"

# Exit successfully
exit 0
