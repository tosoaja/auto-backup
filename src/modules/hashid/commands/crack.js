const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
let _md4Available = true;
let _desAvailable = true;
try { crypto.createHash('md4').update('t').digest(); } catch (e) { _md4Available = false; }
try { crypto.createCipheriv('des-ecb', Buffer.alloc(8), null).update('t'); } catch (e) { _desAvailable = false; }
function _lmKey(half) {
  const tmp = Buffer.alloc(8);
  tmp[0] = half[0] >> 1;
  tmp[1] = ((half[0] & 0x01) << 6) | (half[1] >> 2);
  tmp[2] = ((half[1] & 0x03) << 5) | (half[2] >> 3);
  tmp[3] = ((half[2] & 0x07) << 4) | (half[3] >> 4);
  tmp[4] = ((half[3] & 0x0F) << 3) | (half[4] >> 5);
  tmp[5] = ((half[4] & 0x1F) << 2) | (half[5] >> 6);
  tmp[6] = ((half[5] & 0x3F) << 1) | (half[6] >> 7);
  tmp[7] = half[6] & 0x7F;
  const key = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) { const v = tmp[i] << 1; let bits = 0; for (let b = 1; b < 8; b++) if (v & (1 << b)) bits++; key[i] = v | (bits % 2 === 0 ? 1 : 0); }
  return key;
}
function _lmHash(password) {
  const pwd = password.toUpperCase().substring(0, 14);
  const buf = Buffer.alloc(14, 0);
  for (let i = 0; i < pwd.length; i++) buf[i] = pwd.charCodeAt(i);
  const magic = Buffer.from('KGS!@#$%', 'ascii');
  const halves = [buf.slice(0, 7), buf.slice(7, 14)];
  const c1 = crypto.createCipheriv('des-ecb', _lmKey(halves[0]), null);
  const e1 = Buffer.concat([c1.update(magic), c1.final()]);
  const c2 = crypto.createCipheriv('des-ecb', _lmKey(halves[1]), null);
  const e2 = Buffer.concat([c2.update(magic), c2.final()]);
  return Buffer.concat([e1, e2]).toString('hex').toUpperCase();
}
const HASH_PATTERNS = [
  { name: 'MD5', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'SHA1', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'SHA256', regex: /^[a-f0-9]{64}$/i, bits: 256 },
  { name: 'NTLM', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'LM', regex: /^[a-f0-9]{32}$/i, bits: 128 },
];
module.exports = async function crack({ args }) {
  const hash = (args && args[0]) || '';
  if (!hash) return 'Usage: crack <hash> [wordlist path]';
  const wordlistPath = (args && args[1]) || '/usr/share/wordlists/rockyou.txt';
  if (!fs.existsSync(wordlistPath)) return `Wordlist not found: ${wordlistPath}`;
  const h = hash.trim().toLowerCase();
  const possible = HASH_PATTERNS.filter(p => p.regex.test(h));
  const data = fs.readFileSync(wordlistPath, 'utf8');
  const words = data.split('\n').filter(w => w.trim());
  let found = null;
  for (const word of words) {
    const w = word.trim();
    if (!w) continue;
    for (const t of possible) {
      let computed;
      try {
        if (t.name === 'MD5' || t.name === 'NTLM') {
          if (t.name === 'NTLM') { if (!_md4Available) continue; computed = crypto.createHash('md4').update(Buffer.from(w, 'utf16le')).digest('hex'); }
          else computed = crypto.createHash('md5').update(w).digest('hex');
        } else if (t.name === 'SHA1') computed = crypto.createHash('sha1').update(w).digest('hex');
        else if (t.name === 'SHA256') computed = crypto.createHash('sha256').update(w).digest('hex');
        else if (t.name === 'LM') { if (!_desAvailable) continue; computed = _lmHash(w).toLowerCase(); }
        else computed = crypto.createHash('md5').update(w).digest('hex');
        if (computed === h) { found = w; break; }
      } catch { continue; }
    }
    if (found) break;
  }
  return { hash: h, cracked: !!found, password: found };
};