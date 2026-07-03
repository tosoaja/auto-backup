const fs = require('fs');
module.exports = function opcode({ filePath }) {
  const data = fs.readFileSync(filePath);
  const freq = {};
  for (const b of data) freq[b] = (freq[b] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30);
  let output = `File size: ${data.length} bytes\nTop byte frequencies:\n`;
  output += sorted.map(([k, v]) => `  0x${parseInt(k).toString(16).padStart(2, '0')}: ${v} (${(v / data.length * 100).toFixed(2)}%)`).join('\n');
  return output;
};