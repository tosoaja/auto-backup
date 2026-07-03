const HASH_PATTERNS = [
  { name: 'MD5', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'SHA1', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'SHA224', regex: /^[a-f0-9]{56}$/i, bits: 224 },
  { name: 'SHA256', regex: /^[a-f0-9]{64}$/i, bits: 256 },
  { name: 'SHA384', regex: /^[a-f0-9]{96}$/i, bits: 384 },
  { name: 'SHA512', regex: /^[a-f0-9]{128}$/i, bits: 512 },
  { name: 'SHA3-256', regex: /^[a-f0-9]{64}$/i, bits: 256 },
  { name: 'SHA3-512', regex: /^[a-f0-9]{128}$/i, bits: 512 },
  { name: 'RIPEMD-160', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'NTLM', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'LM', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'MySQL5', regex: /^[a-f0-9]{40}$/i, bits: 160 },
  { name: 'MySQL4.1', regex: /^[a-f0-9]{32}$/i, bits: 128 },
  { name: 'Bcrypt', regex: /^\$2[ayb]\$.+\$.{53}$/ },
  { name: 'SHA512(Unix)', regex: /^\$6\$.+\$.{86}$/ },
  { name: 'SHA256(Unix)', regex: /^\$5\$.+\$.{43}$/ },
  { name: 'MD5(Unix)', regex: /^\$1\$.{8}\$.{22}$/ },
  { name: 'CRC32', regex: /^[a-f0-9]{8}$/i, bits: 32 },
  { name: 'Whirlpool', regex: /^[a-f0-9]{128}$/i, bits: 512 },
  { name: 'GOST', regex: /^[a-f0-9]{64}$/i, bits: 256 },
];
module.exports = function identify({ args }) {
  const hash = (args && args[0]) || '';
  if (!hash) return 'Usage: identify <hash>';
  const h = hash.trim();
  const possible = HASH_PATTERNS.filter(p => p.regex.test(h));
  const unique = [];
  const seen = new Set();
  for (const r of possible) { if (!seen.has(r.name)) { seen.add(r.name); unique.push({ name: r.name, bits: r.bits }); } }
  return { hash: h, length: h.length, possibleTypes: unique, count: unique.length };
};