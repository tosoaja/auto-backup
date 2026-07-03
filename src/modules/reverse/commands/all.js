const { run } = require('../utils/runner');
const sections = require('./sections');
const imports = require('./imports');
const strings = require('./strings');
const packer = require('./packer');
const opcode = require('./opcode');
module.exports = async function all({ filePath }) {
  const results = [];
  results.push('=== FILE INFO ===\n' + (await run(`file "${filePath}"`)).output);
  results.push('\n=== SECTIONS ===\n' + (await sections({ filePath })));
  results.push('\n=== IMPORTS ===\n' + (await imports({ filePath })));
  results.push('\n=== STRINGS ===\n' + (await strings({ filePath, args: ['6'] })));
  results.push('\n=== PACKER ===\n' + (await packer({ filePath })));
  results.push('\n=== OPCODE STATS ===\n' + (await opcode({ filePath })));
  return results.join('\n');
};