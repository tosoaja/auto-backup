const fs = require('fs');
const { run } = require('../utils/runner');

const SIGNATURES = {
  '89504e47': 'PNG image',
  'ffd8ffe0': 'JPEG image',
  'ffd8ffe1': 'JPEG image (EXIF)',
  '25504446': 'PDF document',
  '504b0304': 'ZIP archive',
  '504b0506': 'ZIP archive (EOCD)',
  '504b0708': 'ZIP archive (spanned)',
  '52617221': 'RAR archive',
  '1f8b08': 'GZIP compressed',
  '425a68': 'BZIP2 compressed',
  'fd377a58': 'XZ compressed',
  '377abcaf': '7z archive',
  'd0cf11e0': 'OLE2 / MS Office (old)',
  '3c3f786d': 'XML document',
  '4d5a': 'PE (Windows executable)',
  '7f454c46': 'ELF (Linux executable)',
  'cafebabe': 'Java class / Mach-O',
  'cefafede': 'Mach-O (reverse)',
  'cffaedfe': 'Mach-O 64-bit',
  '000001ba': 'MPEG program stream',
  '494433': 'MP3 audio (ID3v2)',
  '49492a00': 'TIFF image (little-endian)',
  '4d4d002a': 'TIFF image (big-endian)',
  '424d': 'BMP image',
  '47494638': 'GIF image',
  '52494646': 'RIFF / WAV / AVI',
  '2321': 'Shebang script'
};

module.exports = async function signature({ filePath }) {
  const data = fs.readFileSync(filePath);
  const hex = data.slice(0, 16).toString('hex').toLowerCase();

  const detected = [];
  for (const [magic, desc] of Object.entries(SIGNATURES)) {
    if (hex.startsWith(magic)) detected.push(desc);
  }

  const { output } = await run(`file "${filePath}"`);
  const hexSpaced = hex.match(/.{2}/g).join(' ');

  return `Detected: ${detected.join(', ') || 'Unknown'}\nFile output: ${output.trim()}\nMagic bytes (hex): ${hexSpaced}`;
};
