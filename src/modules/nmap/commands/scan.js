const { spawn } = require('child_process');
const { exec } = require('child_process');
module.exports = async function scan({ args }) {
  const target = (args && args[0]) || '';
  if (!target) return 'Usage: scan <target> [ports|common|all|vuln]';
  const sanitized = target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g, '');
  const ports = (args && args[1]) || '1-1000';
  return new Promise((resolve, reject) => {
    exec('which nmap 2>/dev/null', (err, nmapPath) => {
      if (err || !nmapPath.trim()) return resolve('Nmap not installed');
      const nmapArgs = ['-T4', '-v'];
      if (ports === 'common') nmapArgs.push('--top-ports', '100');
      else if (ports === 'all') nmapArgs.push('-p-');
      else if (ports === 'vuln') { nmapArgs.push('--script', 'vuln', '-p', '1-10000'); }
      else nmapArgs.push('-p', ports);
      if (ports !== 'vuln') nmapArgs.push('-sV');
      nmapArgs.push(sanitized);
      const proc = spawn(nmapPath.trim(), nmapArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { output += d.toString(); });
      proc.on('close', (code) => { resolve(output); });
      proc.on('error', (e) => { reject(e.message); });
    });
  });
};