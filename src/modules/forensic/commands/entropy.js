const fs = require('fs');

module.exports = function entropy({ filePath }) {
  const data = fs.readFileSync(filePath);
  const freq = new Array(256).fill(0);
  for (const b of data) freq[b]++;
  let ent = 0;
  for (const f of freq) {
    if (f > 0) {
      const p = f / data.length;
      ent -= p * Math.log2(p);
    }
  }

  let interpretation;
  if (ent > 7) interpretation = 'High (likely encrypted/compressed)';
  else if (ent > 6) interpretation = 'Moderately high';
  else if (ent > 4) interpretation = 'Medium';
  else interpretation = 'Low (plain text/repetitive)';

  return `Entropy: ${ent.toFixed(4)} (max: 8)\nFile size: ${data.length} bytes\nInterpretation: ${interpretation}`;
};
