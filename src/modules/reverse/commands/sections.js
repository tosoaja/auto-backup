const { run } = require('../utils/runner');
module.exports = async function sections({ filePath }) {
  const { output } = await run(`readelf -S "${filePath}" 2>/dev/null || objdump -h "${filePath}" 2>/dev/null || echo "Section analysis not available"`);
  return output;
};