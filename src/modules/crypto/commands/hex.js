module.exports = function hex({ args }) {
  if (!args || args.length < 1) return 'Usage: hex [-e|-d] <text>';
  const flag = args[0];
  const text = args.slice(1).join(' ');
  if (flag === '-e') return Buffer.from(text).toString('hex');
  if (flag === '-d') return Buffer.from(text, 'hex').toString('utf-8');
  return Buffer.from(args.join(' ')).toString('hex');
};
