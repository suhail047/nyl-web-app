// Puts every uploaded photo on a plain white background. The original photo is always kept.
//
// Uses the free "u2net_human_seg" model (Apache-2.0, made for photos of people) and runs on this server,
// so there is no per-photo cost and photos never leave the server. The model (~170 MB) is downloaded
// once, the first time the app starts, into the data folder. Turn off with WHITE_BACKGROUND=false.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ENABLED = process.env.WHITE_BACKGROUND !== 'false';
const MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx';
const MODEL_SHA256 = '01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c';
const MODEL_DIR = process.env.MODEL_DIR || path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db')), 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'u2net_human_seg.onnx');
const SIZE = 320; // the model's input size
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let ort, sharp, session, loading;

async function downloadModel() {
  await fs.promises.mkdir(MODEL_DIR, { recursive: true });
  const tmp = MODEL_PATH + '.part';
  console.log('White background: downloading the photo model (one time, ~170 MB)…');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed (HTTP ${res.status})`);
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(tmp);
  for await (const chunk of res.body) {
    hash.update(chunk);
    if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
  }
  await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
  if (hash.digest('hex') !== MODEL_SHA256) {
    await fs.promises.rm(tmp, { force: true });
    throw new Error('model download was corrupted');
  }
  await fs.promises.rename(tmp, MODEL_PATH);
  console.log('White background: model ready.');
}

function getSession() {
  if (session) return Promise.resolve(session);
  loading ||= (async () => {
    ort = require('onnxruntime-node');
    sharp = require('sharp');
    sharp.cache(false);
    if (!fs.existsSync(MODEL_PATH)) await downloadModel();
    session = await ort.InferenceSession.create(MODEL_PATH, { intraOpNumThreads: 2 });
    return session;
  })().catch((err) => { loading = null; throw err; });
  return loading;
}

// Writes a white-background JPEG next to the original and returns its file name.
async function makeWhite(dir, file) {
  const sess = await getSession();
  const src = path.join(dir, file);
  const { data: rgb, info } = await sharp(src).rotate().removeAlpha().toColourspace('srgb')
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const small = await sharp(rgb, { raw: info }).resize(SIZE, SIZE, { fit: 'fill' }).raw().toBuffer();
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (small[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const pred = out[sess.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (const v of pred) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const mask = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round(((pred[i] - lo) / span) * 255);

  const alpha = await sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .resize(width, height, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < width * height; i++) {
    const a = alpha[i] / 255;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(rgb[i * 3 + c] * a + 255 * (1 - a));
  }
  const name = file.replace(/\.[^.]+$/, '') + '-white.jpg';
  await sharp(rgb, { raw: { width, height, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(dir, name));
  return name;
}

// One photo at a time, so a busy moment never overloads a small server.
const queue = [];
let busy = false;
function enqueue(dir, file, onDone) {
  if (!ENABLED || !file) return;
  queue.push({ dir, file, onDone });
  if (!busy) drain();
}
async function drain() {
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      job.onDone(await makeWhite(job.dir, job.file));
    } catch (err) {
      console.error('White background failed, keeping the original photo:', err.message);
      if (!session) { queue.length = 0; break; } // model not available: try again on the next upload
    }
  }
  busy = false;
}

module.exports = { ENABLED, enqueue, makeWhite };
