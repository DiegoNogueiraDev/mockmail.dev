#!/bin/bash

# =============================================================================
# Quick Setup Script for System Health Monitor
# One-command setup for complete installation and configuration
# =============================================================================

set -euo pipefail

echo "🚀 System Health Monitor - Quick Setup"
echo "======================================"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "❌ Please do not run this script as root"
    echo "   Run: ./quick_setup.sh"
    echo "   The script will ask for sudo when needed"
    exit 1
fi

echo "📋 This will:"
echo "   1. Install required system dependencies"
echo "   2. Configure login banner"
echo "   3. Setup system monitoring"
echo "   4. Test the installation"
echo ""

read -p "Continue with installation? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 0
fi

echo ""
echo "🔧 Step 1: Installing dependencies..."
if [[ -f "install_dependencies.sh" ]]; then
    sudo ./install_dependencies.sh
else
    echo "⚠️  install_dependencies.sh not found, skipping..."
fi

echo ""
echo "📱 Step 2: Setting up login banner..."
if [[ -f "setup_login_banner.sh" ]]; then
    ./setup_login_banner.sh
else
    echo "⚠️  setup_login_banner.sh not found, skipping..."
fi

echo ""
echo "🧪 Step 3: Testing the installation..."
if [[ -f "system_health_monitor.sh" ]]; then
    echo "Testing system health monitor..."
    ./system_health_monitor.sh | head -20
    echo "..."
    echo "(truncated output for quick setup)"
else
    echo "❌ system_health_monitor.sh not found!"
    exit 1
fi

echo ""
echo "🎉 Quick Setup Complete!"
echo "======================="
echo ""
echo "✅ System Health Monitor is now installed and configured"
echo ""
echo "📋 What's been configured:"
echo "   • All required dependencies installed"
echo "   • Login banner configured (will show on next login)"
echo "   • System monitoring ready"
echo "   • Log files configured in /var/log/system_health_monitor.log"
echo ""
echo "🚀 Usage:"
echo "   • Manual run: ./system_health_monitor.sh"
echo "   • Automatic: Will show on next SSH/terminal login"
echo "   • Hourly monitoring: sudo systemctl enable system-health-monitor.timer"
echo ""
echo "📚 Documentation: See README.md for detailed information"
echo ""
echo "💡 Next steps:"
echo "   1. Log out and log back in to see the banner"
echo "   2. Check that MockMail.dev is detected correctly"
echo "   3. Review /var/log/system_health_monitor.log for any issues"
echo ""
echo "🔍 Current system status shows:"
echo "   • MockMail.dev: $(pgrep -f mockmail >/dev/null && echo "RUNNING" || echo "NOT DETECTED")"
echo "   • System Health: $(free | awk 'NR==2{printf "Memory: %.0f%% ", $3*100/$2}')$(df / | awk 'NR==2{printf "Disk: %s", $5}')"
echo ""
