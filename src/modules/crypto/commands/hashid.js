module.exports = function hashid({ args }) {
  if (!args || args.length < 1) return 'Usage: hashid <hash>';
  const hash = args[0];
  const hlen = hash.length;
  const hlow = hash.toLowerCase();

  const patterns = [
    { name: 'MD5', length: 32, charset: 'hex' },
    { name: 'SHA1', length: 40, charset: 'hex' },
    { name: 'SHA256', length: 64, charset: 'hex' },
    { name: 'SHA384', length: 96, charset: 'hex' },
    { name: 'SHA512', length: 128, charset: 'hex' },
    { name: 'SHA3-256', length: 64, charset: 'hex' },
    { name: 'SHA3-512', length: 128, charset: 'hex' },
    { name: 'RIPEMD160', length: 40, charset: 'hex' },
    { name: 'NTLM', length: 32, charset: 'hex' },
    { name: 'LM', length: 32, charset: 'hex' },
    { name: 'MySQL < 4.1', length: 16, charset: 'hex' },
    { name: 'MySQL 5', length: 40, charset: 'hex', prefix: '*' },
    { name: 'MD5 Crypt ($1$)', length: 34, charset: 'base64', prefix: '$1$' },
    { name: 'SHA256 Crypt ($5$)', length: 52, charset: 'base64', prefix: '$5$' },
    { name: 'SHA512 Crypt ($6$)', length: 86, charset: 'base64', prefix: '$6$' },
    { name: 'bcrypt ($2a$)', length: 60, charset: 'base64', prefix: '$2a$' },
    { name: 'bcrypt ($2b$)', length: 60, charset: 'base64', prefix: '$2b$' },
    { name: 'bcrypt ($2y$)', length: 60, charset: 'base64', prefix: '$2y$' },
    { name: 'Blake2b', length: 128, charset: 'hex' },
    { name: 'CRC32', length: 8, charset: 'hex' },
    { name: 'Adler32', length: 8, charset: 'hex' },
    { name: 'Whirlpool', length: 128, charset: 'hex' },
    { name: 'GOST R 34.11-94', length: 64, charset: 'hex' },
  ];

  const isHex = /^[0-9a-f]+$/i.test(hash);
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(hash);

  let possible = patterns.filter(p => {
    if (p.length === 0) return true;
    if (hlen !== p.length && p.length > 0) return false;
    if (p.charset === 'hex' && !isHex) return false;
    if (p.prefix && !hash.startsWith(p.prefix)) return false;
    return true;
  });

  if (possible.length === 0) {
    possible = [{ name: 'Unknown hash format' }];
  }

  return JSON.stringify({
    hash,
    length: hlen,
    charset: isHex ? 'hex' : isBase64 ? 'base64' : 'unknown',
    possibleTypes: possible
  }, null, 2);
};
