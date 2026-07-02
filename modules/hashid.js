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
  for (let i = 0; i < 8; i++) {
    const v = tmp[i] << 1;
    let bits = 0;
    for (let b = 1; b < 8; b++) if (v & (1 << b)) bits++;
    key[i] = v | (bits % 2 === 0 ? 1 : 0);
  }
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
  { name: 'MD4', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'MD2', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'SHA1', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'SHA224', regex: /^[a-f0-9]{56}$/i, bits: 224 },
  { name: 'SHA256', regex: /^[a-f0-9]{64}$/i, bits: 256 },
  { name: 'SHA384', regex: /^[a-f0-9]{96}$/i, bits: 384 },
  { name: 'SHA512', regex: /^[a-f0-9]{128}$/i, bits: 512 },
  { name: 'SHA3-224', regex: /^[a-f0-9]{56}$/i, bits: 224 },
  { name: 'SHA3-256', regex: /^[a-f0-9]{64}$/i, bits: 256 },
  { name: 'SHA3-384', regex: /^[a-f0-9]{96}$/i, bits: 384 },
  { name: 'SHA3-512', regex: /^[a-f0-9]{128}$/i, bits: 512 },
  { name: 'RIPEMD-160', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'Whirlpool', regex: /^[a-f0-9]{128}$/i, bits: 512 },
  { name: 'MySQL5', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'MySQL4.1', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'MD5(APR)', regex: /^\$apr1\$.+\$.{22}$/ },
  { name: 'SHA512(Unix)', regex: /^\$6\$.+\$.{86}$/ },
  { name: 'SHA256(Unix)', regex: /^\$5\$.+\$.{43}$/ },
  { name: 'Bcrypt', regex: /^\$2[ayb]\$.+\$.{53}$/ },
  { name: 'MD5(Sun)', regex: /^\$md5\$.+\$.{22}$/ },
  { name: 'NTLM', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'LM', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'CRC32', regex: /^[a-f0-9]{8}$/i, bits: 32 },
  { name: 'Adler32', regex: /^[a-f0-9]{8}$/i, bits: 32 },
  { name: 'GOST R 34.11-94', regex: /^[a-f0-9]{64}$/i, bits: 256 },
  { name: 'Skype', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'MD5(strtoupper(MD5))', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'MD5(WordPress)', regex: /^\$P\$.{31}$/ },
  { name: 'MD5(phpBB3)', regex: /^\$H\$.{31}$/ },
  { name: 'SHA256(Django)', regex: /^sha256\$.{32}\$.{64}$/ },
  { name: 'PBKDF2-HMAC-SHA256', regex: /^pbkdf2_sha256\$.+\$.+\$.+$/ },
  { name: 'Double SHA1', regex: /^[a-f0-9]{40}$/i, bits: 160 },
];

class HashIdentifier {
  identify(hash) {
    if (!hash || typeof hash !== 'string') {
      return { success: false, error: 'No hash provided' };
    }
    const h = hash.trim();
    const results = HASH_PATTERNS.filter(p => p.regex.test(h));
    const unique = [];
    const seen = new Set();
    for (const r of results) {
      const key = r.name;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ name: r.name, bits: r.bits || null });
      }
    }
    const length = h.length;
    const charset = /^[a-f0-9]+$/i.test(h) ? 'hex' :
                    /^[A-Za-z0-9+/]+={0,2}$/.test(h) ? 'base64' :
                    /^\$/.test(h) ? 'crypt' : 'unknown';
    return {
      success: true,
      hash: h,
      length,
      charset,
      possibleTypes: unique,
      count: unique.length
    };
  }

  async crackWithWordlist(hash, wordlistPath) {
    try {
      const resolved = this.identify(hash);
      if (!resolved.success) return resolved;
      const types = resolved.possibleTypes;
      const hashLower = hash.toLowerCase();
      const wordlist = wordlistPath || path.join(__dirname, '..', 'wordlist.txt');
      if (!fs.existsSync(wordlist)) {
        return { ...resolved, cracked: false, reason: 'Wordlist not found' };
      }
      const data = fs.readFileSync(wordlist, 'utf8');
      const words = data.split('\n').filter(w => w.trim());
      let found = null;
      for (const word of words) {
        const w = word.trim();
        if (!w) continue;
        for (const t of types) {
          const algo = t.name.split('(')[0].split('-')[0].replace(/\s+/g, '');
          let computed;
          try {
            if (t.name === 'MD5' || t.name === 'MD4' || t.name === 'MD2') {
              computed = crypto.createHash('md5').update(w).digest('hex');
            } else if (t.name.startsWith('SHA1') || t.name === 'MySQL5') {
              computed = crypto.createHash('sha1').update(w).digest('hex');
            } else if (t.name === 'SHA224') {
              computed = crypto.createHash('sha224').update(w).digest('hex');
            } else if (t.name === 'SHA256' || t.name === 'SHA3-256') {
              computed = crypto.createHash('sha256').update(w).digest('hex');
            } else if (t.name === 'SHA384') {
              computed = crypto.createHash('sha384').update(w).digest('hex');
            } else if (t.name === 'SHA512' || t.name === 'Whirlpool') {
              computed = crypto.createHash('sha512').update(w).digest('hex');
            } else if (t.name === 'NTLM') {
              if (!_md4Available) continue;
              computed = crypto.createHash('md4').update(Buffer.from(w, 'utf16le')).digest('hex');
            } else if (t.name === 'LM') {
              if (!_desAvailable) continue;
              computed = _lmHash(w);
            } else {
              computed = crypto.createHash('md5').update(w).digest('hex');
            }
            if (computed.toLowerCase() === hashLower) {
              found = w;
              break;
            }
          } catch { continue; }
        }
        if (found) break;
      }
      return { ...resolved, cracked: !!found, password: found };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new HashIdentifier();
