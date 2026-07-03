const fs = require('fs');
const path = require('path');

let TEMP_DIR = path.join(__dirname, '..', '..', '..', '..', 'temp_ctf');

function setTempDir(dir) {
  TEMP_DIR = dir;
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function saveFile(buffer, ext) {
  const fp = path.join(TEMP_DIR, `file_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(fp, buffer);
  return fp;
}

function isInTempDir(filePath) {
  return filePath && filePath.startsWith(TEMP_DIR);
}

function getTempDir() {
  return TEMP_DIR;
}

module.exports = { setTempDir, saveFile, isInTempDir, getTempDir };
