# Deployment Guide

Deploy WhatsFiled on Google Compute Engine as a single VM.

## Architecture

```
                    yourdomain.com
                          │
                          ▼
┌─────────────────────────────────────────────┐
│  GCE VM (e2-small, ~$13/mo)                 │
│                                             │
│  ┌─────────┐      ┌─────────────────────┐   │
│  │ nginx   │ ───► │ Node.js app (:3000) │   │
│  │ (:443)  │      │ ├── Express API     │   │
│  │ + SSL   │      │ ├── Static frontend │   │
│  └─────────┘      │ └── Cron jobs       │   │
│                   └──────────┬──────────┘   │
│                              │              │
│                   ┌──────────▼──────────┐   │
│                   │ PostgreSQL (:5432)  │   │
│                   └─────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| VM (e2-small, 2 vCPU, 2GB RAM) | ~$13 |
| Static IP | Free (while attached) |
| 20GB disk | ~$1 |
| Domain | ~$1 (annual ÷ 12) |
| SSL | Free (Let's Encrypt) |
| **Total** | **~$15/month** |

## Prerequisites

- Google Cloud account with billing enabled
- A domain name (from Cloudflare, Namecheap, etc.)
- `gcloud` CLI installed locally (optional, can use web console)

---

## Step 1: Create the VM

### Via Google Cloud Console

1. Go to [Compute Engine](https://console.cloud.google.com/compute)
2. Click **Create Instance**
3. Configure:
   - **Name**: `whatsfiled`
   - **Region**: Choose one close to your users
   - **Machine type**: `e2-small` (2 vCPU, 2GB RAM)
   - **Boot disk**: Ubuntu 24.04 LTS, 20GB SSD
   - **Firewall**: ✅ Allow HTTP, ✅ Allow HTTPS
4. Click **Create**

### Reserve Static IP

1. Go to **VPC Network** → **IP addresses**
2. Click **Reserve External Static Address**
3. Attach it to your VM

Note the IP address - you'll need it for DNS.

---

## Step 2: Set Up the VM

SSH into the VM:

```bash
gcloud compute ssh whatsfiled
# or use the SSH button in Cloud Console
```

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm and pm2
sudo npm install -g pnpm pm2

# Install nginx and certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

### Set Up PostgreSQL

```bash
# Create database and user
sudo -u postgres psql

CREATE USER whatsfiled WITH PASSWORD 'your-secure-password';
CREATE DATABASE whatsfiled OWNER whatsfiled;
\q
```

---

## Step 3: Deploy the App

### Clone and Build

```bash
# Clone repo
cd ~
git clone https://github.com/YOUR_USERNAME/whatsfiled.git
cd whatsfiled

# Install dependencies
pnpm install

# Build for production
pnpm build:prod
```

### Configure Environment

```bash
# Create environment file
cat > apps/backend/.env.local << 'EOF'
DATABASE_URL=postgresql://whatsfiled:your-secure-password@localhost:5432/whatsfiled
NODE_ENV=production
PORT=3000
EDGAR_USER_AGENT=WhatsFiled contact@yourdomain.com
EOF
```

### Run Database Migrations

```bash
pnpm db:push
```

### Start with pm2

```bash
# Start the app
pm2 start apps/backend/dist/index.js --name whatsfiled

# Save pm2 config and enable startup on reboot
pm2 save
pm2 startup
# Run the command it outputs
```

Verify it's running:

```bash
pm2 status
curl http://localhost:3000/health
```

---

## Step 4: Set Up Domain & SSL

### Point DNS to VM

In your domain registrar (Cloudflare, Namecheap, etc.):

1. Add an **A record**:
   - **Name**: `@` (or subdomain like `app`)
   - **Value**: Your VM's static IP
   - **TTL**: Auto or 300

2. (Optional) Add a **www** redirect:
   - **Name**: `www`
   - **Value**: Your VM's static IP

Wait a few minutes for DNS propagation.

### Configure nginx

```bash
sudo nano /etc/nginx/sites-available/whatsfiled
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/whatsfiled /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Get SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will:
- Get a free SSL certificate from Let's Encrypt
- Configure nginx for HTTPS
- Set up auto-renewal

Verify HTTPS works: `https://yourdomain.com`

---

## Step 5: Updating the App

SSH into the VM and run:

```bash
cd ~/whatsfiled
git pull
pnpm install
pnpm build:prod
pnpm db:push  # if schema changed
pm2 restart whatsfiled
```

### Quick Update Script

Create `~/update.sh`:

```bash
#!/bin/bash
set -e
cd ~/whatsfiled
git pull
pnpm install
pnpm build:prod
pm2 restart whatsfiled
echo "✓ Updated and restarted"
```

```bash
chmod +x ~/update.sh
# Then just run: ~/update.sh
```

---

## Monitoring

### View Logs

```bash
# App logs
pm2 logs whatsfiled

# nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check Status

```bash
pm2 status
pm2 monit  # interactive monitor
```

### Cron Job Logs

```bash
pm2 logs whatsfiled | grep -i cron
```

---

## Maintenance

### SSL Certificate Renewal

Certbot auto-renews. Test it:

```bash
sudo certbot renew --dry-run
```

### Database Backups

```bash
# Manual backup
pg_dump -U whatsfiled whatsfiled > backup_$(date +%Y%m%d).sql

# Restore
psql -U whatsfiled whatsfiled < backup_20240101.sql
```

### Automatic Daily Backups

```bash
# Add to crontab
crontab -e

# Add this line (backs up daily at 3 AM)
0 3 * * * pg_dump -U whatsfiled whatsfiled > ~/backups/whatsfiled_$(date +\%Y\%m\%d).sql
```

---

## Troubleshooting

### App Won't Start

```bash
# Check logs
pm2 logs whatsfiled --lines 50

# Check if port is in use
sudo lsof -i :3000

# Restart
pm2 restart whatsfiled
```

### 502 Bad Gateway

App isn't running or wrong port:

```bash
pm2 status
curl http://localhost:3000/health
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U whatsfiled -d whatsfiled -h localhost
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

---

## Security Checklist

- [ ] Strong PostgreSQL password
- [ ] Firewall allows only 22, 80, 443
- [ ] SSH key authentication (disable password auth)
- [ ] Regular system updates (`sudo apt update && sudo apt upgrade`)
- [ ] Database backups enabled

### Firewall (if needed)

GCE firewall is configured via Cloud Console, but you can also use `ufw`:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Useful Commands

```bash
# SSH into VM
gcloud compute ssh whatsfiled

# App management
pm2 status                    # Check status
pm2 restart whatsfiled        # Restart app
pm2 logs whatsfiled           # View logs
pm2 monit                     # Interactive monitor

# nginx
sudo nginx -t                 # Test config
sudo systemctl reload nginx   # Reload config

# PostgreSQL
sudo -u postgres psql         # Admin access
psql -U whatsfiled whatsfiled # App user access

# System
htop                          # Resource usage
df -h                         # Disk space
```
