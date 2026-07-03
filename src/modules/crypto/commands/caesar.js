module.exports = function caesar({ args }) {
  if (!args || args.length < 1) return 'Usage: caesar <text> [shift]';
  let shift = 13;
  let text;
  if (args.length > 1 && /^-?\d+$/.test(args[args.length - 1])) {
    shift = parseInt(args.pop());
    text = args.join(' ');
  } else {
    text = args.join(' ');
  }
  return text.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 65 && code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + shift + 26) % 26) + base);
  });
};
