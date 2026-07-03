const { exec } = require('child_process');

function run(cmd, timeout = 30000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = stdout || stderr || '';
      resolve({ output: output.slice(0, 50000), error: err ? err.message : null });
    });
  });
}

function runLines(cmd, timeout = 30000) {
  return run(cmd, timeout).then(({ output }) => output.split('\n').filter(l => l.trim()));
}

module.exports = { run, runLines };
