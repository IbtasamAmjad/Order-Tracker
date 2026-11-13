#!/usr/bin/env bash
# Gives the master links a real https address, so WhatsApp turns them into tappable links that open on every phone.
#
# Why: WhatsApp only makes an address tappable when it has a name (not a bare IP number), and phones then try https
# for a named address. The app itself speaks plain http, so it needs a small front door that speaks https. This script
# installs Caddy (a tiny web server that gets and renews a free certificate by itself) and points it at the app.
#
# BEFORE you run it, on the router (port forwarding to THIS machine's fixed local address):
#   - TCP 80   -> this machine, port 80     (only used to get and renew the certificate)
#   - TCP 8443 -> this machine, port 8443   (the https address people open; change it with HTTPS_PORT=...)
#   (Port 443 is not used: on many routers it already belongs to the router's own login page.)
#
# Run it once, from the project folder, as the normal user:
#   bash deploy/linux/setup-https.sh
# With your own domain (its A record must point at the public IP):
#   HOST=orders.yourdomain.com bash deploy/linux/setup-https.sh
# Without a domain it uses a free name that points back at the public IP (for example 203-0-113-10.sslip.io).
# That name stops working if the public IP changes; a real domain does not.
set -euo pipefail

APP_PORT="${PORT:-3002}"
HTTPS_PORT="${HTTPS_PORT:-8443}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE="order-manager"

[ -f "$ROOT/.env.local" ] || { echo "$ROOT/.env.local is missing."; exit 1; }

if [ -z "${HOST:-}" ]; then
  IP="$(curl -fsS https://api.ipify.org || true)"
  [ -n "$IP" ] || { echo "Could not find the public IP address. Run again with HOST=your.name.here"; exit 1; }
  HOST="$(echo "$IP" | tr '.' '-').sslip.io"
fi
echo "The https address will be: https://$HOST:$HTTPS_PORT"

echo "1. Installing Caddy (if it is not installed yet)..."
if ! command -v caddy >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
fi

echo "2. Pointing Caddy at the app (port $APP_PORT)..."
# keep a copy of any Caddyfile that was already there
[ -f /etc/caddy/Caddyfile ] && sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-order-manager.$(date +%s)" || true
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
{
	https_port $HTTPS_PORT
}

$HOST {
	reverse_proxy 127.0.0.1:$APP_PORT
}
EOF
sudo systemctl enable caddy >/dev/null
sudo systemctl restart caddy

echo "3. Firewall on this machine (only if ufw is switched on)..."
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 80/tcp
  sudo ufw allow "$HTTPS_PORT/tcp"
else
  echo "   ufw is not active, nothing to open here."
fi

echo "4. Telling the app to put the https address in its WhatsApp messages (LINK_URL in .env.local)..."
# APP_URL stays as it is (the office keeps using the old address); only the links for masters change.
if grep -q '^LINK_URL=' "$ROOT/.env.local"; then
  sed -i "s#^LINK_URL=.*#LINK_URL=https://$HOST:$HTTPS_PORT#" "$ROOT/.env.local"
else
  printf '\nLINK_URL=https://%s:%s\n' "$HOST" "$HTTPS_PORT" >> "$ROOT/.env.local"
fi
sudo systemctl restart "$SERVICE" || echo "   (service $SERVICE not found: restart the app by hand)"

echo
echo "Done. Wait about a minute, then open https://$HOST:$HTTPS_PORT/ on a phone that is NOT on the office Wi-Fi."
echo "If it shows a certificate warning, check that router port 80 is forwarded to this machine: sudo journalctl -u caddy -n 40"
echo "Then send a new 'Send on WhatsApp' message: the link should turn blue and open."
