const signature = require('./signature');
const entropy = require('./entropy');
const metadata = require('./metadata');
const strings = require('./strings');
const hidden = require('./hidden');
const zipAnalyze = require('./zip');
const binwalk = require('./binwalk');

module.exports = async function all({ filePath, args }) {
  const results = [];
  results.push('=== SIGNATURE ===\n' + (await signature({ filePath })));
  results.push('\n=== ENTROPY ===\n' + (await entropy({ filePath })));
  const meta = await metadata({ filePath });
  results.push('\n=== METADATA ===\n' + (meta.extra || JSON.stringify(meta, null, 2)));
  const s = await strings({ filePath, args });
  results.push('\n=== STRINGS (first 500) ===\n' + s.strings.slice(0, 5000));
  results.push('\n=== HIDDEN ===\n' + (await hidden({ filePath })));

  const zipRes = await zipAnalyze({ filePath });
  if (!zipRes.startsWith('Not')) results.push('\n=== ZIP ===\n' + zipRes);

  const binRes = await binwalk({ filePath });
  if (!binRes.includes('not installed') && !binRes.includes('not installed')) {
    results.push('\n=== BINWALK ===\n' + binRes);
  }

  return results.join('\n');
};
