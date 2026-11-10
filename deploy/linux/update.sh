#!/usr/bin/env bash
# Updates the app on the Linux machine: backup, get the new version, rebuild, start again. Takes a few minutes.
#   bash deploy/linux/update.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE="order-manager"
cd "$ROOT"

echo "1. Stopping the app..."
sudo systemctl stop "$SERVICE"
echo "2. Backing up first..."
node deploy/windows/backup.cjs
echo "3. Getting the new version..."
git pull
npm install
echo "4. Updating the database (safe when there is nothing new)..."
npm run db:migrate
echo "5. Building..."
npm run build
echo "6. Starting the app..."
sudo systemctl start "$SERVICE"
sleep 6
systemctl is-active "$SERVICE"
