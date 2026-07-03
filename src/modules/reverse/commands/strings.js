const fs = require('fs');
const path = require('path');
const { run } = require('../utils/runner');
module.exports = async function strings({ filePath, args }) {
  const minLen = (args && parseInt(args[0])) || 5;
  const { output: strOutput } = await run(`strings -n ${minLen} "${filePath}" 2>/dev/null | sort | uniq | head -500`);
  const { output: fileOut } = await run(`file "${filePath}"`);
  const stat = fs.statSync(filePath);
  const lines = strOutput.split('\n').filter(l => l.trim());
  return `File: ${path.basename(filePath)} (${(stat.size / 1024).toFixed(2)} KB)\nType: ${fileOut.trim()}\nTotal strings: ${lines.length}\n\n${strOutput}`;
};