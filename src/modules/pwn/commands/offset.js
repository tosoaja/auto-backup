module.exports = function offset({ args }) {
  const value = (args && args[0]) || '';
  if (!value) return 'Usage: offset <value>';
  const c = 'abcdefghijklmnopqrstuvwxyz';
  let pat = '';
  const len = 8192;
  for (let i = 0; pat.length < len; i++) {
    pat += c[Math.floor(i / 26 / 26) % 26];
    if (pat.length >= len) break;
    pat += c[Math.floor(i / 26) % 26];
    if (pat.length >= len) break;
    pat += c[i % 26];
  }
  pat = pat.slice(0, len);
  const idx = pat.indexOf(value);
  if (idx >= 0) return `Offset: ${idx} (0x${idx.toString(16)})`;
  const hexPat = Buffer.from(pat).toString('hex');
  const hexIdx = hexPat.indexOf(value);
  if (hexIdx >= 0) return `Offset: ${hexIdx / 2} (0x${(hexIdx / 2).toString(16)}) [hex match]`;
  return 'Not found in cyclic pattern. Try different value or longer pattern.';
};