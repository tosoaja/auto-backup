const { exec } = require('child_process');
const os = require('os');
module.exports = async function traceroute({ args }) {
  const target = (args && args[0]) || 'localhost';
  const sanitized = target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g, '');
  const cmd = os.platform() === 'linux' ? `traceroute -m 30 ${sanitized}` : `tracert ${sanitized}`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (e, stdout, stderr) => {
      resolve(stdout || stderr || 'No output');
    });
  });
};