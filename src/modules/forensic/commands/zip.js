const fs = require('fs');
const { run } = require('../utils/runner');

module.exports = async function zipAnalyze({ filePath }) {
  const { output } = await run(`unzip -l "${filePath}" 2>/dev/null`);
  if (output.includes('not found') || !output.trim()) {
    return 'Not a valid ZIP archive or unzip not available.';
  }

  const stat = fs.statSync(filePath);
  return `ZIP file size: ${(stat.size / 1024).toFixed(2)} KB\nFiles in archive:\n${output}`;
};
