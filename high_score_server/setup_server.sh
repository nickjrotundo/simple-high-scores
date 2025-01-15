#!/bin/bash

# Detect the operating system
if [ -f /etc/debian_version ]; then
    OS="Debian/Ubuntu"
else
    echo "Unsupported operating system. This script only supports Debian/Ubuntu."
    exit 1
fi

echo "Detected OS: $OS"

# Update the system
echo "Updating system packages..."
sudo apt update -y && sudo apt upgrade -y

# Install Node.js and npm
echo "Installing Node.js and npm..."
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    sudo apt install -y nodejs npm
    # Optionally install n for managing Node.js versions
    sudo npm install -g n
    sudo n stable
else
    echo "Node.js and npm are already installed."
fi

# Install pm2 globally
echo "Installing pm2..."
sudo npm install -g pm2

# Install SQLite3 (if not already installed)
echo "Installing SQLite3..."
sudo apt install -y sqlite3

# Install iptables-persistent for saving firewall rules
echo "Installing iptables-persistent..."
sudo apt install -y iptables-persistent

# Open port 3000 in the firewall
echo "Configuring firewall for port 3000..."
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
sudo ip6tables-save | sudo tee /etc/iptables/rules.v6 > /dev/null
sudo systemctl restart netfilter-persistent

# Detect if already in the high_score_server directory
if [ "$(basename "$PWD")" != "high_score_server" ]; then
    echo "Navigating to the high_score_server directory..."
    cd "$(dirname "$0")/high_score_server" || { echo "Failed to navigate to high_score_server directory. Run this script from that directory."; exit 1; }
else
    echo "Already in the high_score_server directory."
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Start the server with pm2
echo "Starting the server with pm2..."
pm2 start server.js --name HSS
pm2 save

# Display server status
pm2 list

# Ask if the user wants to install a certificate
read -p "Do you want to install an SSL certificate for your domain? (y/n): " install_cert

if [ "$install_cert" = "y" ]; then
    # Inform the user of requirements
    echo "You will need the following to proceed with SSL certificate installation:"
    echo "1. A domain name pointing to this server's IP address."
    echo "2. Open ports 80 (HTTP) and 443 (HTTPS) in the firewall. (This script will attempt to open them via iptables if not already open)"
    echo "3. Certbot installed on this server. (This script will attempt to install it if not already installed)"
    echo
    read -p "Do you want to continue? (y/n): " continue_cert
    if [ "$continue_cert" = "y" ]; then
        # Install necessary packages
        echo "Installing Certbot..."
        sudo apt install -y certbot

        # Open ports 80 and 443
        echo "Configuring firewall for ports 80 and 443..."
        sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
        sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
        sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
        sudo ip6tables-save | sudo tee /etc/iptables/rules.v6 > /dev/null
        sudo systemctl restart netfilter-persistent

        # Get server's public IP
        public_ip=$(curl -s ifconfig.me)
        echo "Your server's public IP address is: $public_ip"

        # Run Certbot for SSL certificate installation
        read -p "Enter your domain name (e.g., example.com): " domain
        echo "Running Certbot for domain $domain..."
        sudo certbot certonly --standalone -d "$domain" --preferred-challenges http

        # Check if Certbot succeeded
        if [ $? -eq 0 ]; then
            echo "SSL certificate installed successfully. "
            echo "Certificates are located in /etc/letsencrypt/live/$domain/"
            # Create a directory for SSL certificates
            echo "Creating directory for SSL certificates for node.js..."
            mkdir -p /home/$(whoami)/certs

            # Copy SSL certificates if they exist
            if [ -d "/etc/letsencrypt/live/" ]; then
                echo "Copying SSL certificates..."

                if [ -d "/etc/letsencrypt/live/$domain" ]; then
                    sudo cp /etc/letsencrypt/live/$domain/privkey.pem /home/$(whoami)/certs/
                    sudo cp /etc/letsencrypt/live/$domain/fullchain.pem /home/$(whoami)/certs/
                    sudo chown -R $(whoami):$(whoami) /home/$(whoami)/certs/
                    echo "SSL certificates have been copied to /home/$(whoami)/certs/"
                else
                    echo "No certificates found for $domain in /etc/letsencrypt/live/."
                    echo "Ensure Certbot has successfully installed the certificates."
                    echo "The command to run Certbot manually is: sudo certbot certonly --standalone -d $domain --preferred-challenges http"
                fi
            else
                echo "No certificates found. Certbot may not have been run yet."
                echo "The command to run Certbot manually is: sudo certbot certonly --standalone -d $domain --preferred-challenges http"
            fi
        else
            echo "Certbot failed to install the certificate. Check the error message and try again."
            echo "The command to run Certbot manually is: sudo certbot certonly --standalone -d $domain --preferred-challenges http"
        fi
        
    else
        echo "SSL certificate installation skipped."
        echo "The command to run Certbot manually is: sudo certbot certonly --standalone -d $domain --preferred-challenges http"
    fi
else
    echo "SSL certificate installation skipped."
    echo "The command to run Certbot manually is: sudo certbot certonly --standalone -d $domain --preferred-challenges http"
fi

echo "Setup complete! The server is running on port 3000."
echo "You can veryfy by visiting https://$domain:3000/top_100 in your browser."