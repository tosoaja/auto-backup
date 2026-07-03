const fs = require('fs');
const { run } = require('../utils/runner');
module.exports = async function elf({ filePath }) {
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 4).toString() !== '\x7fELF') {
    const { output } = await run(`file "${filePath}"`);
    return 'Not a valid ELF binary.\n' + output;
  }
  const { output } = await run(`readelf -h "${filePath}" 2>/dev/null || elfdump "${filePath}" 2>/dev/null || file "${filePath}"`);
  return output;
};