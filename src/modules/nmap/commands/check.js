const { exec } = require('child_process');
module.exports = async function check() {
  return new Promise((resolve) => {
    exec('which nmap 2>/dev/null', (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve({ installed: false, message: 'Nmap not installed. Run: sudo apt install nmap -y' });
      } else {
        const nmapPath = stdout.trim();
        exec(`${nmapPath} --version 2>/dev/null | head -1`, (e, v) => {
          resolve({ installed: true, path: nmapPath, version: v.trim() || 'Unknown' });
        });
      }
    });
  });
};