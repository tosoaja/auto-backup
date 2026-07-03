const { run } = require('../utils/runner');
module.exports = async function exports({ filePath }) {
  const { output } = await run(`nm -D "${filePath}" 2>/dev/null | head -100 || objdump -T "${filePath}" 2>/dev/null | grep -i ' DF ' | head -100 || echo "Export analysis not available"`);
  return output;
};