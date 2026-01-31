#!/bin/bash

# =============================================================================
# Setup Script for System Health Monitor Login Banner
# Configures the system health monitor to run automatically on login
# =============================================================================

set -euo pipefail

readonly SCRIPT_PATH="$(pwd)/system_health_monitor.sh"
readonly PROFILE_FILES=("$HOME/.bashrc" "$HOME/.profile" "$HOME/.zshrc")
readonly BANNER_MARKER="# SYSTEM_HEALTH_MONITOR_BANNER"

echo "🔧 Setting up System Health Monitor for automatic execution on login..."

# Verify the main script exists
if [[ ! -f "$SCRIPT_PATH" ]]; then
    echo "❌ Error: system_health_monitor.sh not found in current directory"
    exit 1
fi

# Function to add banner to profile file
add_to_profile() {
    local profile_file="$1"
    
    if [[ -f "$profile_file" ]]; then
        # Check if already configured
        if grep -q "$BANNER_MARKER" "$profile_file"; then
            echo "✅ $profile_file already configured"
            return 0
        fi
        
        # Add the banner configuration
        cat >> "$profile_file" << PROFILE_CONTENT

$BANNER_MARKER
# Automatically run System Health Monitor on login
if [[ \$- == *i* ]] && [[ -f "$SCRIPT_PATH" ]]; then
    # Only run in interactive shells and if script exists
    "$SCRIPT_PATH"
fi
$BANNER_MARKER

PROFILE_CONTENT
        
        echo "✅ Added banner to $profile_file"
        return 0
    fi
    
    return 1
}

# Setup for different shell profile files
configured_count=0
for profile_file in "${PROFILE_FILES[@]}"; do
    if add_to_profile "$profile_file"; then
        configured_count=$((configured_count + 1))
    fi
done

if [[ $configured_count -eq 0 ]]; then
    echo "⚠️  No profile files found. Creating ~/.bashrc..."
    touch "$HOME/.bashrc"
    add_to_profile "$HOME/.bashrc"
    configured_count=1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo "📊 System Health Monitor configured for $configured_count profile file(s)"
echo ""
echo "📋 Next steps:"
echo "   1. The monitor will run automatically on your next login"
echo "   2. To run it manually now: ./system_health_monitor.sh"
echo "   3. To disable: remove lines between $BANNER_MARKER markers from your shell profile"
echo ""
echo "🔍 The script monitors:"
echo "   • System resources (CPU, Memory, Disk)"
echo "   • Network connectivity and interfaces"
echo "   • Running processes and services"
echo "   • MockMail.dev application status"
echo "   • Security status and recommendations"
echo ""
echo "📝 Logs are stored in: /var/log/system_health_monitor.log"
