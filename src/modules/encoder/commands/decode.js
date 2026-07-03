module.exports = function decode({ args }) {
  if (!args || args.length < 2) return 'Usage: decode <type> <text>';

  const type = args[0].toLowerCase();
  const text = args.slice(1).join(' ');

  const decoders = {
    base64: () => Buffer.from(text, 'base64').toString('utf-8'),
    hex: () => Buffer.from(text, 'hex').toString('utf-8'),
    url: () => decodeURIComponent(text),
    html: () => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, '\''),
    unicode: () => text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
    binary: () => text.split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join(''),
    octal: () => text.split(/\\/).filter(Boolean).map(o => String.fromCharCode(parseInt(o, 8))).join(''),
    rot13: () => text.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
      return c;
    }),
    reverse: () => text.split('').reverse().join('')
  };

  const decoder = decoders[type];
  if (!decoder) {
    return `Unsupported decoding type: ${type}\nSupported: ${Object.keys(decoders).join(', ')}`;
  }

  try {
    return decoder();
  } catch (err) {
    return `[!] Decode error: ${err.message}`;
  }
};
