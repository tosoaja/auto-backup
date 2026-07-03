module.exports = function pattern({ args }) {
  const len = parseInt((args && args[0]) || '256');
  const c = 'abcdefghijklmnopqrstuvwxyz';
  let pat = '';
  for (let i = 0; pat.length < len; i++) {
    pat += c[Math.floor(i / 26 / 26) % 26];
    if (pat.length >= len) break;
    pat += c[Math.floor(i / 26) % 26];
    if (pat.length >= len) break;
    pat += c[i % 26];
  }
  return pat.slice(0, len);
};