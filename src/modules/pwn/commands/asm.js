const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const TEMP_DIR = path.resolve(process.cwd(), 'temp_ctf');
module.exports = async function asm({ args }) {
  const asmCode = (args && args.join(' ')) || 'nop';
  const fp = path.join(TEMP_DIR, `asm_${Date.now()}.s`);
  fs.writeFileSync(fp, `.intel_syntax noprefix\n${asmCode}\n`);
  return new Promise((resolve) => {
    exec(`as -o "${fp}.o" "${fp}" 2>/dev/null && objdump -d "${fp}.o" 2>/dev/null | grep -v 'file format' | tail -n +3 || echo "Assembly failed"`, { timeout: 15000 }, (e, stdout) => {
      try { fs.unlinkSync(fp); fs.unlinkSync(fp + '.o'); } catch {}
      resolve(stdout || 'No output');
    });
  });
};