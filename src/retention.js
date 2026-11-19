// Photos are kept for PHOTO_RETENTION_DAYS (default 30) and then deleted automatically.
// Only the photo file goes: the session's answers, plan position and payment stay in the database.
const fs = require('node:fs');
const path = require('node:path');
const { q } = require('./db');

const DAYS = Math.max(1, Number(process.env.PHOTO_RETENTION_DAYS) || 30);

function deleteOldPhotos(uploadDir) {
  let deleted = 0;
  for (const v of q.photosOlderThan.all(`-${DAYS} days`)) {
    try {
      fs.rmSync(path.join(uploadDir, path.basename(v.photo_file)), { force: true });
      q.clearPhoto.run(v.id);
      deleted++;
    } catch (err) {
      console.error('Could not delete old photo', v.photo_file, err.message);
    }
  }
  if (deleted) console.log(`Photo clean-up: deleted ${deleted} photo(s) older than ${DAYS} days.`);
  return deleted;
}

// Runs at start-up and then every hour.
function startPhotoCleanup(uploadDir) {
  deleteOldPhotos(uploadDir);
  setInterval(() => deleteOldPhotos(uploadDir), 3600 * 1000).unref();
}

module.exports = { DAYS, deleteOldPhotos, startPhotoCleanup };
