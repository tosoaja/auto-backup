const fs = require('fs');
const path = require('path');
const { run } = require('../utils/runner');

module.exports = async function metadata({ filePath }) {
  const stat = fs.statSync(filePath);
  const info = {
    fileName: path.basename(filePath),
    size: stat.size,
    sizeHuman: (stat.size / 1024).toFixed(2) + ' KB',
    created: stat.birthtime || stat.ctime,
    modified: stat.mtime,
    accessed: stat.atime,
    mode: stat.mode.toString(8),
    isDirectory: stat.isDirectory(),
    isSymlink: stat.isSymbolicLink()
  };

  let extra = '';
  const { output: fileOut } = await run(`file "${filePath}"`);
  extra += fileOut;

  const { output: exifOut } = await run(`exiftool "${filePath}" 2>/dev/null || echo "exiftool not available"`);
  if (!exifOut.includes('not available')) extra += '\n' + exifOut;

  return { ...info, extra };
};
