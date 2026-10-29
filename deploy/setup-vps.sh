#!/usr/bin/env bash
# One-step install / update of the patient app on a fresh Ubuntu or Debian VPS (e.g. Hostinger KVM).
#
#   sudo bash deploy/setup-vps.sh yourdomain.com     # with HTTPS on your domain (recommended)
#   sudo bash deploy/setup-vps.sh                    # no domain yet: plain http://<server-ip>
#
# Run it again after uploading a new version of the app to update it. Patient data is kept.
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR=/opt/patient-app
DATA_DIR=/var/lib/patient-app
ENV_FILE=/etc/patient-app.env
SERVICE=patient-app
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "please run with sudo (or as root)."
[ -f "$SRC_DIR/server.js" ] || die "run this from inside the unzipped app folder."
command -v apt-get >/dev/null || die "this script supports Ubuntu/Debian only."
export DEBIAN_FRONTEND=noninteractive

say "Installing system packages"
apt-get update -y
apt-get install -y curl ca-certificates gnupg rsync ufw

node_ok() {
  command -v node >/dev/null &&
    node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'
}
if ! node_ok; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  node_ok || die "Node.js 22.13+ could not be installed."
fi
NODE_BIN="$(command -v node)"

if ! command -v caddy >/dev/null; then
  say "Installing Caddy (web server with automatic HTTPS)"
  if ! apt-get install -y caddy; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  fi
fi

say "Copying the app to $APP_DIR"
id patientapp >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin patientapp
mkdir -p "$APP_DIR" "$DATA_DIR/uploads"
if [ "$SRC_DIR" != "$APP_DIR" ]; then
  rsync -a --delete --exclude node_modules --exclude .git --exclude .env --exclude data --exclude uploads "$SRC_DIR"/ "$APP_DIR"/
fi
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund
chown -R root:root "$APP_DIR"
chown -R patientapp:patientapp "$DATA_DIR"
chmod 750 "$DATA_DIR"

if [ ! -f "$ENV_FILE" ]; then
  say "App settings (you can change these later in $ENV_FILE)"
  DEFAULT_NAME="Suhail's Healing"
  read -rp "App name [$DEFAULT_NAME]: " CLINIC_NAME
  CLINIC_NAME="${CLINIC_NAME:-$DEFAULT_NAME}"
  while :; do
    read -rsp "Choose an admin dashboard password (8+ characters): " ADMIN_PASSWORD; echo
    read -rsp "Type it again: " ADMIN_PASSWORD2; echo
    if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then echo "Too short, try again."
    elif [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD2" ]; then echo "They don't match, try again."
    elif [[ "$ADMIN_PASSWORD" == *'"'* || "$ADMIN_PASSWORD" == *'\'* ]]; then echo "Please don't use \" or \\ in the password."
    else break; fi
  done
  read -rp "UPI ID for payments [suhailbinalionline-2@oksbi]: " UPI_ID
  UPI_ID="${UPI_ID:-suhailbinalionline-2@oksbi}"
  read -rp "Name on that UPI account [$CLINIC_NAME]: " UPI_NAME
  UPI_NAME="${UPI_NAME:-$CLINIC_NAME}"
  umask 077
  cat > "$ENV_FILE" <<ENV
# Settings for the patient app. After editing: sudo systemctl restart $SERVICE
HOST=127.0.0.1
PORT=3000
DB_PATH=$DATA_DIR/app.db
UPLOAD_DIR=$DATA_DIR/uploads
CLINIC_NAME="$CLINIC_NAME"
ADMIN_USER=admin
ADMIN_PASSWORD="$ADMIN_PASSWORD"
UPI_ID="$UPI_ID"
UPI_NAME="$UPI_NAME"
CONSULTATION_FEE_INR=
OTP_ENABLED=false
SMS_PROVIDER=console
ENV
  umask 022
else
  say "Keeping existing settings in $ENV_FILE"
fi

say "Setting up the background service"
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=Patient intake app
After=network.target

[Service]
User=patientapp
Group=patientapp
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN --disable-warning=ExperimentalWarning server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"

say "Configuring the web server"
SITE="${DOMAIN:-:80}"
[ -f /etc/caddy/Caddyfile ] && [ ! -f /etc/caddy/Caddyfile.orig ] && cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.orig
cat > /etc/caddy/Caddyfile <<CADDY
$SITE {
	encode gzip
	request_body {
		max_size 20MB
	}
	reverse_proxy 127.0.0.1:3000
}
CADDY
if [ -n "$DOMAIN" ] && [[ "$DOMAIN" != www.* ]]; then
  # Also answer on www.<domain> by redirecting to the main address.
  printf '\nwww.%s {\n\tredir https://%s{uri} permanent\n}\n' "$DOMAIN" "$DOMAIN" >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy

say "Turning on the firewall (SSH, HTTP, HTTPS only)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

sleep 2
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 30 --no-pager; die "the app did not start (see the log above)."; }

IP="$(hostname -I | awk '{print $1}')"
URL="${DOMAIN:+https://$DOMAIN}"
URL="${URL:-http://$IP}"
say "Done!"
cat <<MSG
  Patient app:      $URL
  Admin dashboard:  $URL/admin   (user: admin)

  Change settings:  sudo nano $ENV_FILE   then   sudo systemctl restart $SERVICE
  See the app log:  sudo journalctl -u $SERVICE -f
  Patient data:     $DATA_DIR   (back this up)
MSG
if [ -n "$DOMAIN" ]; then
  echo "  HTTPS needs your domain's DNS 'A' record pointing to $IP. Caddy keeps retrying until it does."
fi
