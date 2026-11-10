#!/usr/bin/env bash
# Runs Custom Order Manager on a Linux machine (Ubuntu) as a service on a FIXED port: it starts by itself when the
# machine starts, starts again if it stops, and a backup is made every night at 2 AM.
#
# Run it once, from the project folder, as the normal user (it asks for the sudo password when it needs it):
#   bash deploy/linux/setup-service.sh            (uses port 3002)
#   PORT=8080 bash deploy/linux/setup-service.sh  (another port)
#
# Before you run it: stop the app if it is running by hand (Ctrl + C), and make sure .env.local exists with
# ADMIN_PASSWORD, SESSION_SECRET and APP_URL (the address people will type, for example http://203.0.113.10:3002).
set -euo pipefail

PORT="${PORT:-3002}"
TIMEZONE="${TIMEZONE:-Asia/Karachi}"   # the app shows every date and time in this time zone
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE="order-manager"
NODE="$(command -v node || true)"

[ -n "$NODE" ] || { echo "Node.js is not installed (node was not found)."; exit 1; }
[ -f "$ROOT/.env.local" ] || { echo "$ROOT/.env.local is missing. Copy .env.example to .env.local and fill it in first."; exit 1; }
grep -q '^APP_URL=' "$ROOT/.env.local" || { echo "APP_URL is missing in .env.local."; exit 1; }
cd "$ROOT"

echo "1. Making the database ready and building the app (this takes a minute or two)..."
npm run db:migrate
npm run build

echo "2. Making the service '$SERVICE' (starts by itself, port $PORT, time zone $TIMEZONE)..."
sudo tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<EOF
[Unit]
Description=Custom Order Manager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$ROOT
Environment=NODE_ENV=production
Environment=TZ=$TIMEZONE
ExecStart=$NODE $ROOT/node_modules/next/dist/bin/next start -H 0.0.0.0 -p $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE" >/dev/null
sudo systemctl restart "$SERVICE"

echo "3. Firewall on this machine (only if ufw is switched on)..."
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow "$PORT/tcp"
else
  echo "   ufw is not active, nothing to open here."
fi

echo "4. Nightly backup at 2 AM (database and pictures, last 14 days; set BACKUP_DIR in .env.local to choose where)..."
CRON="0 2 * * * cd $ROOT && $NODE $ROOT/deploy/windows/backup.cjs >> $ROOT/backups.log 2>&1"
( crontab -l 2>/dev/null | grep -v "deploy/windows/backup.cjs" ; echo "$CRON" ) | crontab -

sleep 6
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/admin/login" | grep -q 200; then
  echo
  echo "Done. The app answers on this machine: http://localhost:$PORT/admin"
else
  echo
  echo "The app did not answer yet. Look at the log with:  sudo journalctl -u $SERVICE -n 50 --no-pager"
fi
echo
echo "For the person who sets up the firewall / router:"
echo "  forward TCP port $PORT  ->  this machine's local address ${LAN_IP:-<its local address>} port $PORT"
echo "  (give this machine a fixed local address in the router first, so the forwarding keeps working)"
echo "Then APP_URL in .env.local must be exactly the public address, and then run:  sudo systemctl restart $SERVICE"
