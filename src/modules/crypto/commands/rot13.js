module.exports = function rot13({ args }) {
  if (!args || args.length < 1) return 'Usage: rot13 <text>';
  const text = args.join(' ');
  return text.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
    return c;
  });
};
