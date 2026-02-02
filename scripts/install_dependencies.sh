#!/bin/bash

# =============================================================================
# Install Dependencies for System Health Monitor
# Ensures all required packages are installed for optimal functionality
# =============================================================================

set -euo pipefail

readonly REQUIRED_PACKAGES=(
    "sysstat"      # For iostat, mpstat, sar
    "net-tools"    # For netstat, ifconfig
    "htop"         # Enhanced process viewer
    "iotop"        # I/O monitoring
    "lsof"         # List open files
    "curl"         # For connectivity tests
    "wget"         # For downloads
    "tree"         # Directory structure visualization
)

readonly OPTIONAL_PACKAGES=(
    "docker.io"    # For Docker container monitoring
    "docker-compose" # Docker Compose
    "nginx"        # Web server (if needed for MockMail)
    "redis-server" # Redis server (commonly used)
    "postgresql"   # PostgreSQL (for database applications)
)

echo "🔧 Installing dependencies for System Health Monitor..."
echo "📦 This will install monitoring and system utilities"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    echo "⚠️  This script requires root privileges to install packages."
    echo "Please run with sudo: sudo ./install_dependencies.sh"
    exit 1
fi

# Update package lists
echo "📥 Updating package lists..."
apt update

# Install required packages
echo "📦 Installing required packages..."
for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! dpkg -l | grep -qw "^ii.*$package"; then
        echo "  Installing $package..."
        apt install -y "$package"
    else
        echo "  ✅ $package already installed"
    fi
done

# Ask about optional packages
echo ""
echo "🤔 Optional packages for enhanced functionality:"
for package in "${OPTIONAL_PACKAGES[@]}"; do
    if ! dpkg -l | grep -qw "^ii.*$package"; then
        read -p "Install $package? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "  Installing $package..."
            apt install -y "$package"
        fi
    else
        echo "  ✅ $package already installed"
    fi
done

# Create log directory with proper permissions
echo "📁 Setting up log directory..."
mkdir -p /var/log/system_health_monitor
chown $(logname):$(logname) /var/log/system_health_monitor 2>/dev/null || true
chmod 755 /var/log/system_health_monitor

# Create systemd service for regular monitoring (optional)
cat > /etc/systemd/system/system-health-monitor.service << 'SERVICE_CONTENT'
[Unit]
Description=System Health Monitor
After=network.target

[Service]
Type=oneshot
User=root
ExecStart=/bin/bash SCRIPT_PATH_PLACEHOLDER
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_CONTENT

# Replace placeholder with actual script path
sed -i "s|SCRIPT_PATH_PLACEHOLDER|$(pwd)/system_health_monitor.sh|g" /etc/systemd/system/system-health-monitor.service

# Create timer for regular execution
cat > /etc/systemd/system/system-health-monitor.timer << 'TIMER_CONTENT'
[Unit]
Description=Run System Health Monitor every hour
Requires=system-health-monitor.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
TIMER_CONTENT

echo ""
echo "🎉 Dependencies installation completed!"
echo ""
echo "📋 Installed utilities:"
echo "   • sysstat (mpstat, iostat, sar)"
echo "   • net-tools (netstat, ifconfig)"  
echo "   • htop (enhanced process monitoring)"
echo "   • iotop (I/O monitoring)"
echo "   • lsof (open file monitoring)"
echo ""
echo "⚙️  Optional systemd service created:"
echo "   • Enable hourly monitoring: systemctl enable system-health-monitor.timer"
echo "   • Start timer: systemctl start system-health-monitor.timer"
echo "   • Check status: systemctl status system-health-monitor.timer"
echo ""
echo "📝 Log directory created: /var/log/system_health_monitor/"
echo ""
echo "🚀 Ready to run: ./system_health_monitor.sh"
