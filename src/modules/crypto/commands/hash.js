const crypto = require('crypto');

module.exports = function hash({ args }) {
  if (!args || args.length < 2) return 'Usage: hash <algorithm> <text>\nAlgorithms: md5, sha1, sha256, sha512';
  const algorithm = args[0].toLowerCase();
  const text = args.slice(1).join(' ');

  const supported = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'ripemd160', 'sha3-256', 'sha3-512'];
  if (!supported.includes(algorithm)) {
    return `Unsupported algorithm: ${algorithm}\nSupported: ${supported.join(', ')}`;
  }

  return crypto.createHash(algorithm).update(text).digest('hex');
};
