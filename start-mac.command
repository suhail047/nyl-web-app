#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then run this again."
  open https://nodejs.org; read -p "Press Enter to close"; exit 1
fi
node src/check-node.js || { open https://nodejs.org; read -p "Press Enter to close"; exit 1; }
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || { echo "Installing, please wait..."; npm install || { echo "Install failed - see the messages above."; read -p "Press Enter to close"; exit 1; }; }
[ -f data/nyl.db ] || npm run seed
echo
echo "Starting... the browser will open when the app is ready."
echo "OTP codes will appear in this window. Close this window to stop the app."
echo
OPEN_BROWSER=1 npm start
echo
echo "The app stopped - see the messages above."
read -p "Press Enter to close"
