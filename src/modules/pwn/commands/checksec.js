const { exec } = require('child_process');
module.exports = async function checksec({ filePath }) {
  return new Promise((resolve) => {
    exec(`checksec --file="${filePath}" 2>/dev/null || readelf -l "${filePath}" 2>/dev/null | head -30 || objdump -p "${filePath}" 2>/dev/null | head -30 || echo "No binary analysis tools available"`, { timeout: 15000 }, (e, stdout) => {
      resolve(stdout || 'No output');
    });
  });
};