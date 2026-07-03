const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = async function crack({ args }) {
  if (!args || args.length < 1) return 'Usage: crack <hash> [wordlist path]';
  const hash = args[0].toLowerCase();
  const wordlistPath = args[1] || '/usr/share/wordlists/rockyou.txt';

  if (!fs.existsSync(wordlistPath)) {
    return `Wordlist not found: ${wordlistPath}\nUsage: crack <hash> [wordlist path]`;
  }

  const hlen = hash.length;
  let type = 'unknown';
  if (hlen === 32 && /^[0-9a-f]+$/.test(hash)) type = 'md5';
  else if (hlen === 40 && /^[0-9a-f]+$/.test(hash)) type = 'sha1';
  else if (hlen === 64 && /^[0-9a-f]+$/.test(hash)) type = 'sha256';

  const wordlist = fs.readFileSync(wordlistPath, 'utf-8').split('\n').filter(l => l.trim());
  let found = null;

  for (let i = 0; i < Math.min(wordlist.length, 100000); i++) {
    const word = wordlist[i].trim();
    if (!word) continue;
    let computed;
    switch (type) {
    case 'md5': computed = crypto.createHash('md5').update(word).digest('hex'); break;
    case 'sha1': computed = crypto.createHash('sha1').update(word).digest('hex'); break;
    case 'sha256': computed = crypto.createHash('sha256').update(word).digest('hex'); break;
    default: return `Unsupported hash type (length ${hlen}). Only MD5/SHA1/SHA256 supported.`;
    }
    if (computed === hash) { found = word; break; }
    if ((i + 1) % 10000 === 0) { /* progress */ }
  }

  if (found) return `Cracked: ${hash} => ${found}`;
  return `Not cracked after checking ${Math.min(wordlist.length, 100000)} passwords.`;
};
