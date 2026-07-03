module.exports = function list() {
  const types = ['base64', 'hex', 'url', 'html', 'unicode', 'binary', 'octal', 'rot13', 'reverse'];
  return `Supported encoding types:\n  ${types.join('\n  ')}\n\nUsage: encode <type> <text>  or  decode <type> <text>`;
};
