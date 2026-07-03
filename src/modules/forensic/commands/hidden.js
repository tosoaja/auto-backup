const fs = require('fs');
const path = require('path');
const { run } = require('../utils/runner');

module.exports = async function hidden({ filePath }) {
  const results = [];
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.zip' || ext === '.jar') {
    const { output } = await run(`unzip -l "${filePath}" 2>/dev/null`);
    results.push({ check: 'ZIP contents', info: output });
  }

  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const { output } = await run(`exiftool "${filePath}" 2>/dev/null | grep -i comment || echo "No hidden data in metadata"`);
    results.push({ check: 'Metadata comments', info: output });

    const data = fs.readFileSync(filePath);
    const iend = data.toString('latin1').lastIndexOf('IEND');
    if (iend > 0) {
      const afterIEND = data.slice(iend + 8);
      if (afterIEND.length > 4) {
        results.push({ check: 'Data after IEND (PNG)', info: `${afterIEND.length} bytes found after IEND chunk` });
      }
    }
  }

  if (results.length === 0) {
    results.push({ check: 'No hidden data detected', info: 'No obvious hidden data found.' });
  }

  return results.map(r => `${r.check}: ${r.info}`).join('\n');
};
