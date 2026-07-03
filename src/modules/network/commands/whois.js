const { exec } = require('child_process');
module.exports = async function whois({ args }) {
  const target = (args && args[0]) || '';
  if (!target) return 'Usage: whois <domain>';
  const sanitized = target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g, '');
  return new Promise((resolve) => {
    exec(`whois ${sanitized} 2>/dev/null || echo 'whois not installed'`, { timeout: 30000 }, (e, stdout, stderr) => {
      resolve(stdout || stderr || 'No output');
    });
  });
};