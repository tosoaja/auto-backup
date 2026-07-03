module.exports = function encode({ args }) {
  if (!args || args.length < 2) return 'Usage: encode <type> <text>';

  const type = args[0].toLowerCase();
  const text = args.slice(1).join(' ');

  const encoders = {
    base64: () => Buffer.from(text).toString('base64'),
    hex: () => Buffer.from(text).toString('hex'),
    url: () => encodeURIComponent(text),
    html: () => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'),
    unicode: () => text.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
    binary: () => text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '),
    octal: () => text.split('').map(c => '\\' + c.charCodeAt(0).toString(8)).join(''),
    rot13: () => text.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
      return c;
    }),
    reverse: () => text.split('').reverse().join('')
  };

  const encoder = encoders[type];
  if (!encoder) {
    return `Unsupported encoding type: ${type}\nSupported: ${Object.keys(encoders).join(', ')}`;
  }

  return encoder();
};
