const crypto = require('crypto');

class PasswordGenerator {
  generate(options = {}) {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      excludeSimilar = false,
      minUppercase = 1,
      minLowercase = 1,
      minNumbers = 1,
      minSymbols = 1,
      count = 1
    } = options;

    let chars = '';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?~';

    if (excludeSimilar) {
      chars = chars.replace(/[il1Lo0O]/g, '');
    }

    if (!chars) {
      return { success: false, error: 'No character sets selected' };
    }

    const passwords = [];
    const validLength = Math.max(length, minUppercase + minLowercase + minNumbers + minSymbols);

    for (let n = 0; n < count; n++) {
      let password = '';
      const pool = crypto.randomBytes(validLength * 10);

      for (let i = 0; i < validLength; i++) {
        password += chars[pool[i] % chars.length];
      }

      password = this._ensureRequirements(password, {
        uppercase, lowercase, numbers, symbols,
        minUppercase, minLowercase, minNumbers, minSymbols, chars
      });

      passwords.push(password);
    }

    const entropy = Math.log2(chars.length) * validLength;

    return {
      success: true,
      passwords,
      count: passwords.length,
      length: validLength,
      entropy: Math.round(entropy),
      strength: entropy >= 128 ? 'Very Strong' : entropy >= 80 ? 'Strong' : entropy >= 60 ? 'Moderate' : entropy >= 40 ? 'Weak' : 'Very Weak',
      options: { uppercase, lowercase, numbers, symbols, excludeSimilar, length: validLength }
    };
  }

  _ensureRequirements(pwd, opts) {
    let result = pwd;
    const ensureChar = (pool, min) => {
      for (let i = 0; i < min; i++) {
        if (!new RegExp(`[${pool.replace(/]/g, '\\]').replace(/[-]/g, '\\-')}]`).test(result)) {
          const pos = crypto.randomInt(result.length);
          const arr = result.split('');
          arr[pos] = pool[crypto.randomInt(pool.length)];
          result = arr.join('');
        }
      }
    };
    if (opts.uppercase) ensureChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ', opts.minUppercase);
    if (opts.lowercase) ensureChar('abcdefghijklmnopqrstuvwxyz', opts.minLowercase);
    if (opts.numbers) ensureChar('0123456789', opts.minNumbers);
    if (opts.symbols) ensureChar('!@#$%^&*()_+-=[]{}|;:,.<>?~', opts.minSymbols);
    return result;
  }
}

module.exports = new PasswordGenerator();
