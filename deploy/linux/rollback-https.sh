#!/usr/bin/env bash
# Undoes deploy/linux/setup-https.sh: the app goes back to listening on 0.0.0.0:<public port> (plain http, as before),
# Caddy is switched off, and APP_URL goes back to the http address it had.
#   bash deploy/linux/rollback-https.sh
#   OLD_APP_URL=http://203.0.113.10:3002 bash deploy/linux/rollback-https.sh   (when the saved copy of .env.local is gone)
#
# It does NOT delete the certificate, acme.sh, the acme-dns account or the Caddy package: running setup-https.sh
# again is quick. (The CNAME record in Squarespace can stay; it does no harm.)
# After it, everybody opens the old http:// address again, and links sent while https was on must be sent again.
set -euo pipefail

PUBLIC_PORT="${PUBLIC_PORT:-3002}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE="order-manager"
UNIT="/etc/systemd/system/$SERVICE.service"

[ -f "$UNIT" ] || { echo "The service $SERVICE does not exist."; exit 1; }

echo "1. Stopping Caddy (it will not start again at boot)..."
sudo systemctl stop caddy 2>/dev/null || true
sudo systemctl disable caddy >/dev/null 2>&1 || true

echo "2. Putting the app back on 0.0.0.0:$PUBLIC_PORT..."
sudo systemctl stop "$SERVICE"
sudo sed -i -E "s#(next start) -H [^ ]+ -p [0-9]+#\1 -H 0.0.0.0 -p $PUBLIC_PORT#" "$UNIT"
sudo systemctl daemon-reload

echo "3. Putting APP_URL back to http..."
OLD=""
if [ -n "${OLD_APP_URL:-}" ]; then
  OLD="$OLD_APP_URL"
elif [ -f "$ROOT/.env.local.before-https" ]; then
  OLD="$(grep '^APP_URL=' "$ROOT/.env.local.before-https" | head -1 | cut -d= -f2-)"
fi
if [ -z "$OLD" ]; then
  echo "   The old APP_URL is not saved. Run again with:  OLD_APP_URL=http://<public ip>:$PUBLIC_PORT bash deploy/linux/rollback-https.sh"
  sudo systemctl start "$SERVICE"
  exit 1
fi
sed -i "s#^APP_URL=.*#APP_URL=$OLD#" "$ROOT/.env.local"
echo "   APP_URL=$OLD"

sudo systemctl start "$SERVICE"
sleep 6
CODE="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "http://localhost:$PUBLIC_PORT/admin/login" || true)"
echo
if [ "$CODE" = "200" ]; then
  echo "DONE. The app answers again on plain http: $OLD/admin  (answer $CODE)"
else
  echo "The app answered '$CODE', not 200. Look at:  sudo journalctl -u $SERVICE -n 40 --no-pager"
fi
echo "Masters whose links were sent while https was on need the link sent again (Masters page > Send link on WhatsApp)."
