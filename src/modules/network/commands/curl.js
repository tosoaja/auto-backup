const { exec } = require('child_process');
module.exports = async function curl({ args }) {
  const target = (args && args[0]) || '';
  if (!target) return 'Usage: curl <url>';
  const sanitized = target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g, '');
  return new Promise((resolve) => {
    exec(`curl -I -s ${sanitized} 2>/dev/null | head -20 || echo 'curl failed'`, { timeout: 30000 }, (e, stdout, stderr) => {
      resolve(stdout || stderr || 'No output');
    });
  });
};