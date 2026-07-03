const { run } = require('../utils/runner');

module.exports = async function binwalk({ filePath }) {
  const { output } = await run(`binwalk "${filePath}" 2>/dev/null || echo "binwalk not installed"`);
  return output;
};
