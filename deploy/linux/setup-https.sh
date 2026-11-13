#!/usr/bin/env bash
# Puts https on the SAME public port the app already uses (3002), so the router does not change at all.
#
# Why: WhatsApp makes a link tappable only when it has a real name, and then the phone tries https first. The app
# itself only speaks plain http, so tapping fails (pasting into the address bar works, because you type http://).
# After this script:
#   - Caddy listens on 3002 and speaks https, with a real free certificate for the name (Let's Encrypt)
#   - the app moves to 127.0.0.1:3003 (only this machine can reach it)
#   - APP_URL in .env.local becomes https://<name>:3002, so every WhatsApp link is https and opens when tapped
#
# The certificate is proved by DNS (DNS-01), so no port 80 or 443 is needed. The domain's DNS (Squarespace) has no
# API, so the proof is delegated: you add ONE CNAME record, _acme-challenge.<name>, that points to a free acme-dns
# server (auth.acme-dns.io). acme.sh then writes the proof there by itself, now and at every renewal (about every
# 60 days, by a cron job of root). Nothing else in your DNS is ever touched.
#
# Run it once, from the project folder, as the normal user (it asks for the sudo password when it needs it):
#   bash deploy/linux/setup-https.sh
#   HOST=orders.example.com bash deploy/linux/setup-https.sh      (another name)
#
# It stops and WAITS after printing the CNAME. Add it in Squarespace, then press Enter. You can run it again safely:
# it reuses the registration it already made. To undo everything:  bash deploy/linux/rollback-https.sh
#
# NOTE for the office: after this, people open https://<name>:3002 (the old http:// address stops working, a port
# can speak only one of the two). Links already sent to masters must be sent again. If the name does not open from
# INSIDE the office network, see "If the name does not open inside the office" at the end of the output.
set -euo pipefail

HOST="${HOST:-orders.labtasks.com}"
PUBLIC_PORT="${PUBLIC_PORT:-3002}"   # the port the router already forwards, and the one in the links
APP_PORT="${APP_PORT:-3003}"         # where the app listens now, on this machine only
ACMEDNS_SERVER="${ACMEDNS_SERVER:-https://auth.acme-dns.io}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE="order-manager"
UNIT="/etc/systemd/system/$SERVICE.service"
CERT_DIR="/etc/caddy/certs"
REG_FILE="$HOME/.order-manager-acmedns.json"   # the acme-dns account (a secret, only you can read it)
SUB="_acme-challenge.$HOST"
ACME="/root/.acme.sh/acme.sh"

[ -f "$ROOT/.env.local" ] || { echo "$ROOT/.env.local is missing."; exit 1; }
[ -f "$UNIT" ] || { echo "The service $SERVICE does not exist. Run deploy/linux/setup-service.sh first."; exit 1; }
[ -t 0 ] || { echo "Run this in a terminal: it waits for you to add the DNS record."; exit 1; }
command -v python3 >/dev/null || { echo "python3 is needed (it is on every Ubuntu)."; exit 1; }

echo "Name: $HOST   public port: $PUBLIC_PORT   app moves to 127.0.0.1:$APP_PORT"
echo

# ---------------------------------------------------------------- 1. tools
echo "1. Installing what is needed (Caddy, curl, dig)..."
sudo apt-get update -y >/dev/null
sudo apt-get install -y curl dnsutils debian-keyring debian-archive-keyring apt-transport-https gpg >/dev/null
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y >/dev/null
  sudo apt-get install -y caddy >/dev/null
fi
# Caddy starts by itself on port 80 with a welcome page when it is installed; it is not wanted there
sudo systemctl stop caddy 2>/dev/null || true

# ---------------------------------------------------------------- 2. the acme-dns account and the CNAME
echo "2. Registering a free acme-dns account for the certificate proof..."
if [ ! -s "$REG_FILE" ]; then
  curl -fsS -X POST "$ACMEDNS_SERVER/register" -o "$REG_FILE" || { echo "Could not reach $ACMEDNS_SERVER."; rm -f "$REG_FILE"; exit 1; }
  chmod 600 "$REG_FILE"
fi
field() { python3 -c "import json,sys; print(json.load(open('$REG_FILE'))['$1'])"; }
ACMEDNS_USERNAME="$(field username)"
ACMEDNS_PASSWORD="$(field password)"
ACMEDNS_SUBDOMAIN="$(field subdomain)"
TARGET="$(field fulldomain)"

# the part of the name that goes in Squarespace's "Host" box (the domain itself is added by Squarespace)
APEX="$(echo "$HOST" | awk -F. '{print $(NF-1)"."$NF}')"
HOSTPART="_acme-challenge.${HOST%."$APEX"}"
[ "$HOSTPART" = "_acme-challenge.$HOST" ] && HOSTPART="_acme-challenge"   # the name is the domain itself

cat <<EOF

=====================================================================================================
  ADD THIS ONE DNS RECORD in Squarespace  (Domains > $APEX > DNS Settings > Add record)

      Type : CNAME
      Host : $HOSTPART
      Data : $TARGET

  (written out in full that is:  $SUB.  CNAME  $TARGET.)
  Leave every other record as it is. Squarespace may take a few minutes to publish it.
=====================================================================================================

EOF
check_cname() { dig +short CNAME "$SUB" @1.1.1.1 2>/dev/null | sed 's/\.$//' | grep -qx "$TARGET"; }
while true; do
  read -r -p "Press Enter once you have added the record (Ctrl+C to stop; running again later is safe)... " _
  if check_cname; then echo "   The record is visible. Good."; break; fi
  echo "   The record is NOT visible yet (it can take a few minutes). Checked: dig CNAME $SUB"
  read -r -p "   Check again (Enter), or type 'go' to continue anyway: " ans
  [ "$ans" = "go" ] && break
  check_cname && { echo "   The record is visible. Good."; break; }
done

# ---------------------------------------------------------------- 3. the certificate
echo "3. Getting the certificate with acme.sh (Let's Encrypt, proved by DNS)..."
if ! sudo test -x "$ACME"; then
  curl -fsS https://get.acme.sh | sudo -H sh -s >/dev/null   # installs for root: its cron job renews the certificate
fi
sudo mkdir -p "$CERT_DIR"
sudo chown root:caddy "$CERT_DIR" 2>/dev/null || true
sudo chmod 750 "$CERT_DIR"
ACME_ENV=(ACMEDNS_BASE_URL="$ACMEDNS_SERVER" ACMEDNS_USERNAME="$ACMEDNS_USERNAME" ACMEDNS_PASSWORD="$ACMEDNS_PASSWORD" ACMEDNS_SUBDOMAIN="$ACMEDNS_SUBDOMAIN")
sudo -H env "${ACME_ENV[@]}" "$ACME" --set-default-ca --server letsencrypt >/dev/null
RC=0
sudo -H env "${ACME_ENV[@]}" "$ACME" --issue --dns dns_acmedns -d "$HOST" --server letsencrypt --dnssleep 30 || RC=$?
if [ "$RC" -ne 0 ] && [ "$RC" -ne 2 ]; then   # 2 = "still valid, skipped" (a run again)
  echo "The certificate was not issued. Check that the CNAME above is correct, then run this script again."
  exit 1
fi
# copy the certificate where Caddy reads it; the same command runs again after every renewal
sudo -H "$ACME" --install-cert -d "$HOST" \
  --fullchain-file "$CERT_DIR/fullchain.pem" --key-file "$CERT_DIR/privkey.pem" \
  --reloadcmd "chgrp caddy $CERT_DIR/fullchain.pem $CERT_DIR/privkey.pem; chmod 640 $CERT_DIR/fullchain.pem $CERT_DIR/privkey.pem; systemctl reload caddy 2>/dev/null || true" >/dev/null
sudo test -s "$CERT_DIR/fullchain.pem" || { echo "The certificate file is missing."; exit 1; }
echo "   Certificate in place. It renews by itself (cron of root)."

# ---------------------------------------------------------------- 4. switch the ports (short pause for the app)
echo "4. Moving the app to 127.0.0.1:$APP_PORT and putting https on port $PUBLIC_PORT..."
STAMP="$(date +%s)"
# rollback-https.sh puts APP_URL back from this copy; it is only made while APP_URL is still the http address (a re-run must not overwrite it)
if grep -q '^APP_URL=http://' "$ROOT/.env.local" || [ ! -f "$ROOT/.env.local.before-https" ]; then cp "$ROOT/.env.local" "$ROOT/.env.local.before-https"; fi
[ -f "$UNIT.before-https" ] || sudo cp "$UNIT" "$UNIT.before-https"
[ -f /etc/caddy/Caddyfile ] && sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-order-manager.$STAMP" || true
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
{
	# no automatic certificates and no port 80: the certificate below is renewed by acme.sh
	auto_https disable_redirects
}

$HOST:$PUBLIC_PORT {
	tls $CERT_DIR/fullchain.pem $CERT_DIR/privkey.pem
	reverse_proxy 127.0.0.1:$APP_PORT
}
EOF
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || { echo "Caddy does not accept its config. Nothing was switched."; exit 1; }

sudo systemctl stop "$SERVICE"
sudo sed -i -E "s#(next start) -H [^ ]+ -p [0-9]+#\1 -H 127.0.0.1 -p $APP_PORT#" "$UNIT"
sudo systemctl daemon-reload
# the address people use, in every WhatsApp link (cookies also become https-only, so the office must use https too)
sed -i "s#^APP_URL=.*#APP_URL=https://$HOST:$PUBLIC_PORT#" "$ROOT/.env.local"
sudo systemctl start "$SERVICE"
sudo systemctl enable caddy >/dev/null 2>&1 || true
sudo systemctl restart caddy

# ---------------------------------------------------------------- 5. firewall and test
if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow "$PUBLIC_PORT/tcp" >/dev/null   # already open; the app port $APP_PORT is NOT opened, only this machine uses it
fi
sleep 6
CODE="$(curl -sk -o /dev/null -m 15 -w '%{http_code}' --resolve "$HOST:$PUBLIC_PORT:127.0.0.1" "https://$HOST:$PUBLIC_PORT/admin/login" || true)"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
if [ "$CODE" = "200" ]; then
  echo "DONE. https on this machine works: https://$HOST:$PUBLIC_PORT/admin  (answer $CODE)"
else
  echo "The https test answered '$CODE', not 200. Look at:  sudo journalctl -u caddy -n 40 --no-pager   and   sudo journalctl -u $SERVICE -n 40 --no-pager"
  echo "To go back at once:  bash deploy/linux/rollback-https.sh"
fi
cat <<EOF

What people do now
  - Everyone (office and masters) opens   https://$HOST:$PUBLIC_PORT
  - The old http://...:$PUBLIC_PORT address no longer works. Links sent before must be sent again:
    Masters page > "Send link on WhatsApp". New links are blue in WhatsApp and open when tapped.
  - Test it from a phone on MOBILE DATA (not the office Wi-Fi) first.
  - The router does not change: it already forwards TCP $PUBLIC_PORT to this machine ($LAN_IP).

If the name does not open inside the office
  Reason: from inside, the name points at the public address, and some routers cannot loop that back in.
  Outside (mobile data) it works, inside it does not. Fix, in this order:
  1. Give the office a local name for this machine: in the UniFi router, add a local DNS record
     $HOST  ->  ${LAN_IP:-<this machine's local address>}
     (UniFi Network: Settings > Routing > DNS, or Settings > Policy Table > DNS "Local DNS record", depending on version).
     Then the office reaches the machine directly. The certificate still matches, because the NAME is the same.
     Windows/Mac/Linux computers may need a restart or: ipconfig /flushdns
  2. No local DNS record? On ONE office computer, add this line to its hosts file (as administrator):
     ${LAN_IP:-<local address>}  $HOST
     Windows: C:\\Windows\\System32\\drivers\\etc\\hosts      Mac/Linux: /etc/hosts
  3. Do NOT use https://${LAN_IP:-<local address>}:$PUBLIC_PORT : the browser warns, because the certificate is for the name.
  4. Phones on the office Wi-Fi can use mobile data instead, or the same local DNS record (step 1 covers them).

To undo everything:  bash deploy/linux/rollback-https.sh     (app back on 0.0.0.0:$PUBLIC_PORT, Caddy off, APP_URL back to http)
EOF
