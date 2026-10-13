#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then run this again."
  open https://nodejs.org; read -p "Press Enter to close"; exit 1
fi
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || { echo "Installing, please wait..."; npm install || { read -p "Press Enter to close"; exit 1; }; }
[ -f data/nyl.db ] || npm run seed
echo
echo "Patient app:     http://localhost:3000"
echo "Admin dashboard: http://localhost:3000/admin   (user: admin, password: see ADMIN_PASSWORD in .env)"
echo "OTP codes will appear in this window. Close this window to stop the app."
echo
(sleep 2; open http://localhost:3000) &
npm start
