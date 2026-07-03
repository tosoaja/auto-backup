const { exec } = require('child_process');
module.exports = async function rop({ filePath }) {
  return new Promise((resolve) => {
    exec(`ROPgadget --binary "${filePath}" 2>/dev/null | head -100 || echo "ROPgadget not installed"`, { timeout: 60000 }, (e, stdout) => {
      resolve(stdout || 'No output');
    });
  });
};