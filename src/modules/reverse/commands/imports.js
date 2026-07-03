const { run } = require('../utils/runner');
module.exports = async function imports({ filePath }) {
  const { output } = await run(`objdump -T "${filePath}" 2>/dev/null | head -100 || nm -D "${filePath}" 2>/dev/null | head -100 || readelf -s "${filePath}" 2>/dev/null | head -100 || echo "Import analysis not available"`);
  return output;
};