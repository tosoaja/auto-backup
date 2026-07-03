const crypto = require('crypto');

module.exports = function aes({ args }) {
  if (!args || args.length < 3) return 'Usage: aes <-e|-d> <key> <text>';
  const flag = args[0];
  const key = args[1];
  const text = args.slice(2).join(' ');

  const keyBuf = crypto.createHash('sha256').update(key).digest();

  try {
    if (flag === '-e') {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
      let encrypted = cipher.update(text, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } else if (flag === '-d') {
      const parts = text.split(':');
      if (parts.length !== 2) return 'Invalid encrypted format. Expected iv:encrypted';
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    }
    return 'Usage: aes <-e|-d> <key> <text>';
  } catch (err) {
    return `[!] AES error: ${err.message}`;
  }
};
