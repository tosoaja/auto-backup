module.exports = function base64({ args }) {
  if (!args || args.length < 1) return 'Usage: base64 [-e|-d] <text>';
  const flag = args[0];
  const text = args.slice(1).join(' ');
  if (flag === '-e') return Buffer.from(text).toString('base64');
  if (flag === '-d') return Buffer.from(text, 'base64').toString('utf-8');
  return Buffer.from(args.join(' ')).toString('base64');
};
