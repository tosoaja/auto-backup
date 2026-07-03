module.exports = function freq({ args }) {
  if (!args || args.length < 1) return 'Usage: freq <text>';
  const text = args.join(' ').toLowerCase();
  const counts = {};
  let total = 0;
  for (const c of text) {
    if (/[a-z]/.test(c)) {
      counts[c] = (counts[c] || 0) + 1;
      total++;
    }
  }
  if (total === 0) return 'No letters found in input.';

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const expected = 'etaoinshrdlcumwfgypbvkjxqz';

  let result = 'Character frequency (sorted by count):\n';
  result += 'Char | Count | Percent\n';
  result += '-' .repeat(30) + '\n';
  for (const [char, count] of sorted) {
    result += `  ${char}   | ${String(count).padStart(4)} | ${(count / total * 100).toFixed(1)}%\n`;
  }
  result += `\nTotal letters: ${total}\n`;
  result += `Most common: ${sorted.slice(0, 5).map(([c]) => c).join(', ')}\n`;
  result += `Expected (English): ${expected.slice(0, 5)}\n`;
  return result;
};
