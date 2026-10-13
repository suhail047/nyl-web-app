// Runs before `npm start` / `npm run seed`. Kept to old-style JavaScript so it
// can print a helpful message even on very old Node.js versions.
var parts = process.versions.node.split('.').map(Number);
if (parts[0] < 22 || (parts[0] === 22 && parts[1] < 13)) {
  console.error('');
  console.error('  This app needs Node.js 22.13 or newer. You have Node.js ' + process.versions.node + '.');
  console.error('  Download the LTS version from https://nodejs.org, install it,');
  console.error('  close this window and start the app again.');
  console.error('');
  process.exit(1);
}
