const { exec } = require('child_process');
module.exports = async function ping({ args }) {
  const target = (args && args[0]) || 'localhost';
  const sanitized = target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g, '');
  return new Promise((resolve) => {
    exec(`ping -c 4 ${sanitized}`, { timeout: 30000 }, (e, stdout, stderr) => {
      resolve(stdout || stderr || 'No output');
    });
  });
};