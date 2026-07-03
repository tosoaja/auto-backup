const fs = require('fs');
const path = require('path');
const { run } = require('../utils/runner');
module.exports = async function pe({ filePath }) {
  const { output } = await run(`exiftool "${filePath}" 2>/dev/null | head -40 || file "${filePath}"`);
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 2).toString() !== 'MZ') return 'Not a valid PE file.\n' + output;
  let info = `File: ${path.basename(filePath)}\nSize: ${(data.length / 1024).toFixed(2)} KB\n`;
  const peOffset = data.readUInt32LE(0x3C);
  info += `PE header offset: 0x${peOffset.toString(16)}\n`;
  if (peOffset < data.length && data.slice(peOffset, peOffset + 2).toString() === 'PE') {
    const machine = { 0x14c: 'x86', 0x8664: 'x64', 0x1c0: 'ARM', 0xaa64: 'ARM64', 0x200: 'Itanium' };
    info += `Machine: ${machine[data.readUInt16LE(peOffset + 4)] || 'Unknown'}\n`;
    info += `Sections: ${data.readUInt16LE(peOffset + 6)}\n`;
    info += `Characteristics: 0x${data.readUInt16LE(peOffset + 22).toString(16)}\n`;
  }
  return info + '\n' + output;
};