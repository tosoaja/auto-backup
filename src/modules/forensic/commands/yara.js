const { run } = require('../utils/runner');

module.exports = async function yara({ filePath }) {
  const { output } = await run(
    `yara -w /usr/share/yara-rules/*.yar "${filePath}" 2>/dev/null || yara -w /etc/yara/*.yar "${filePath}" 2>/dev/null || echo "YARA not configured. Install yara and rules."`
  );
  return output;
};
