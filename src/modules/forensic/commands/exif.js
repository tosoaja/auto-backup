const { run } = require('../utils/runner');

module.exports = async function exif({ filePath }) {
  const { output } = await run(
    `exiftool "${filePath}" 2>/dev/null || identify -verbose "${filePath}" 2>/dev/null || echo "No EXIF tool available"`
  );
  return output;
};
