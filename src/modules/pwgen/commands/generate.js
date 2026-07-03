const crypto = require('crypto');
module.exports = function generate({ args }) {
  const opts = { length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true, excludeSimilar: false, count: 1 };
  if (args) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--length') opts.length = parseInt(args[++i]) || 16;
      else if (args[i] === '--count') opts.count = parseInt(args[++i]) || 1;
      else if (args[i] === '--nosymbols') opts.symbols = false;
      else if (args[i] === '--noupper') opts.uppercase = false;
      else if (args[i] === '--nolower') opts.lowercase = false;
      else if (args[i] === '--nonumbers') opts.numbers = false;
      else if (args[i] === '--nosimilar') opts.excludeSimilar = true;
    }
  }
  let chars = '';
  if (opts.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (opts.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (opts.numbers) chars += '0123456789';
  if (opts.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?~';
  if (opts.excludeSimilar) chars = chars.replace(/[il1Lo0O]/g, '');
  if (!chars) return { success: false, error: 'No character sets selected' };
  const passwords = [];
  for (let n = 0; n < opts.count; n++) {
    let pwd = '';
    const pool = crypto.randomBytes(opts.length * 10);
    for (let i = 0; i < opts.length; i++) pwd += chars[pool[i] % chars.length];
    passwords.push(pwd);
  }
  const entropy = Math.log2(chars.length) * opts.length;
  return {
    passwords, count: passwords.length, length: opts.length,
    entropy: Math.round(entropy),
    strength: entropy >= 128 ? 'Very Strong' : entropy >= 80 ? 'Strong' : entropy >= 60 ? 'Moderate' : 'Weak'
  };
};