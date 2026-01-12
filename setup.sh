#!/bin/bash

# DrafterAPI Auto-Setup Script
# Usage: ./setup.sh

set -e # Exit on error

echo -e "\033[36m[DrafterAPI] Starting Auto-Setup...\033[0m"

# 1. Check & Install Node.js
if ! command -v node &> /dev/null; then
    echo -e "\033[33m[!] Node.js not found. Installing...\033[0m"
    
    # Check for Debian/Ubuntu
    if [ -f /etc/debian_version ]; then
        # Update and install curl
        if ! command -v curl &> /dev/null; then
            echo "Installing curl..."
            apt-get update
            apt-get install -y curl
        fi

        # Install Node.js 20.x
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        echo -e "\033[31m[!] Unsupported OS. Please install Node.js manually.\033[0m"
        exit 1
    fi
else
    echo -e "\033[32m[+] Node.js is already installed.\033[0m"
fi

# 2. Install Server Dependencies
echo -e "\033[36m[DrafterAPI] Installing Server Dependencies...\033[0m"
cd server
npm install
cd ..

# 3. Install Client Dependencies & Build
echo -e "\033[36m[DrafterAPI] Building Frontend...\033[0m"
cd client
npm install
npm run build
cd ..

# 4. Success Message
echo -e "\n\033[32m---------------------------------------------------\033[0m"
echo -e "\033[32m[+] Setup Complete!\033[0m"
echo -e "\033[32m---------------------------------------------------\033[0m"
echo -e "1. Generate your login key (Run this once):"
echo -e "   \033[33mnode server/index.js key\033[0m"
echo -e ""
echo -e "2. Start the server:"
echo -e "   \033[33mnode server/index.js\033[0m"
echo -e ""
echo -e "   (Or use './start.sh' to keep it running)"
