const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const SOUNDS_DIR = path.join(__dirname, '..', 'sounds');
const cache = new Map();

function getSoundFiles() {
  if (!fs.existsSync(SOUNDS_DIR)) return [];
  return fs.readdirSync(SOUNDS_DIR)
    .filter((f) => ['.mp3', '.wav', '.ogg', '.flac'].includes(path.extname(f).toLowerCase()))
    .slice(0, 25); // Discord max: 5 rows x 5 buttons
}

function loadSound(filename) {
  if (cache.has(filename)) return Promise.resolve(cache.get(filename));

  return new Promise((resolve, reject) => {
    const filePath = path.join(SOUNDS_DIR, filename);
    const chunks = [];

    const ffmpeg = spawn(ffmpegPath, [
      '-i', filePath,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        cache.set(filename, buffer);
        resolve(buffer);
      } else {
        reject(new Error(`Failed to load ${filename}`));
      }
    });
    ffmpeg.on('error', reject);
  });
}

module.exports = { getSoundFiles, loadSound, SOUNDS_DIR };
