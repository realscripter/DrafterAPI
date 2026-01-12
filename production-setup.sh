#!/bin/bash

# DrafterAPI Production Setup Script (Nginx + SSL)
# Usage: ./production-setup.sh <domain_name>

if [ -z "$1" ]; then
    echo "Usage: ./production-setup.sh <domain_name>"
    echo "Example: ./production-setup.sh panel.example.com"
    exit 1
fi

DOMAIN=$1

echo -e "\033[36m[DrafterAPI] Setting up Production Environment for $DOMAIN...\033[0m"

# 1. Update Server to listen on 127.0.0.1 only (Already done in code, but ensuring we pull latest)
echo "Pulling latest updates..."
node server/index.js update

# 2. Install Nginx
echo "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get update
    apt-get install -y nginx
fi

# 3. Configure Firewall
echo "Configuring Firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw deny 8000/tcp # Block direct access
ufw --force enable

# 4. Create Nginx Config
echo "Creating Nginx Configuration..."
CONFIG_FILE="/etc/nginx/sites-available/drafterapi"
cat > $CONFIG_FILE <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable Site
ln -sf /etc/nginx/sites-available/drafterapi /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and Reload
nginx -t && systemctl reload nginx

# 5. SSL with Certbot
echo "Setting up SSL with Let's Encrypt..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
fi

certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect

echo -e "\n\033[32m---------------------------------------------------\033[0m"
echo -e "\033[32m[+] Production Setup Complete!\033[0m"
echo -e "Your dashboard is now available at: \033[36mhttps://$DOMAIN\033[0m"
echo -e "Make sure to start your server with: \033[33m./start.sh\033[0m"
