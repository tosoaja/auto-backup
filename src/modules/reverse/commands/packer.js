const fs = require('fs');
const path = require('path');
module.exports = function packer({ filePath }) {
  const data = fs.readFileSync(filePath);
  const strContent = data.toString('latin1').toLowerCase();
  const sigs = [
    { name: 'UPX', sig: /upx/ }, { name: 'ASPack', sig: /aspack/ }, { name: 'PECompact', sig: /pecompact/ },
    { name: 'Armadillo', sig: /armadillo/ }, { name: 'Themida', sig: /themida|winlicense/ },
    { name: 'VMProtect', sig: /vmp\d|vmprotect/ }, { name: 'Enigma', sig: /enigma\sprotector/ },
    { name: 'MPRESS', sig: /mpress/ }, { name: 'FSG', sig: /fsg!/ }
  ];
  const results = [];
  for (const p of sigs) { if (p.sig.test(strContent)) results.push(p.name); }
  if (results.length === 0) {
    const freq = new Array(256).fill(0);
    for (const b of data) freq[b]++;
    let ent = 0;
    for (const f of freq) { if (f > 0) { const pct = f / data.length; ent -= pct * Math.log2(pct); } }
    if (ent > 7) results.push('High entropy - possible packing/encryption');
    else results.push('No known packer detected');
  }
  return `Packer detection for: ${path.basename(filePath)}\n\nDetected: ${results.join(', ') || 'None'}`;
};