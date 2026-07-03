const { run } = require('../utils/runner');

module.exports = async function strings({ filePath, args }) {
  const minLen = args && args.length > 1 ? parseInt(args[1]) : 4;
  const { output } = await run(
    `strings -n ${minLen} "${filePath}" 2>/dev/null || strings "${filePath}" 2>/dev/null || echo "strings not available"`
  );
  const lines = output.split('\n').filter(l => l.trim());
  const unique = [...new Set(lines)];
  return { total: unique.length, strings: unique.slice(0, 1000).join('\n') };
};
