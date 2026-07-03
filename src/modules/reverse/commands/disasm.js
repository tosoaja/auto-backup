const { run } = require('../utils/runner');
module.exports = async function disasm({ filePath }) {
  const { output } = await run(`objdump -d "${filePath}" 2>/dev/null | head -200 || ndisasm -b 64 "${filePath}" 2>/dev/null | head -200 || echo "No disassembler available"`);
  return output;
};