const { exec } = require('child_process');
function run(cmd, timeout = 30000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve((stdout || stderr || '').slice(0, 50000));
    });
  });
}
module.exports = { run };