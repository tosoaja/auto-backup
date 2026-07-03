const { exec } = require('child_process');
const os = require('os');
module.exports = async function netstat() {
  const cmd = os.platform() === 'linux' ? `netstat -tulanp 2>/dev/null | head -50` : `netstat -an`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (e, stdout, stderr) => {
      resolve(stdout || stderr || 'No output');
    });
  });
};