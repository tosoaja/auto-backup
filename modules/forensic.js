const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const TEMP_DIR = path.join(__dirname, '..', 'temp_ctf');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function _run(cmd, timeout = 30000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const output = stdout || stderr || '';
      resolve({ output: output.slice(0, 50000), error: err ? err.message : null });
    });
  });
}

function _saveFile(buffer, ext) {
  const fp = path.join(TEMP_DIR, `file_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(fp, buffer);
  return fp;
}

async function metadata(filePath) {
  const stat = fs.statSync(filePath);
  const info = {
    fileName: path.basename(filePath),
    size: stat.size,
    sizeHuman: (stat.size / 1024).toFixed(2) + ' KB',
    created: stat.birthtime || stat.ctime,
    modified: stat.mtime,
    accessed: stat.atime,
    mode: stat.mode.toString(8),
    isDirectory: stat.isDirectory(),
    isSymlink: stat.isSymbolicLink()
  };
  let extra = '';
  const { output } = await _run(`file "${filePath}"`);
  extra += output;
  const { output: exifOut } = await _run(`exiftool "${filePath}" 2>/dev/null || echo "exiftool not available"`);
  if (!exifOut.includes('not available')) extra += '\n' + exifOut;
  return { ...info, extra };
}

async function exif(filePath) {
  const { output } = await _run(`exiftool "${filePath}" 2>/dev/null || identify -verbose "${filePath}" 2>/dev/null || echo "No EXIF tool available"`);
  return output;
}

async function strings(filePath) {
  const minLen = 4;
  const { output } = await _run(`strings -n ${minLen} "${filePath}" 2>/dev/null || strings "${filePath}" 2>/dev/null || echo "strings not available"`);
  const lines = output.split('\n').filter(l => l.trim());
  const unique = [...new Set(lines)];
  return { total: unique.length, strings: unique.slice(0, 1000).join('\n') };
}

async function hidden(filePath) {
  const results = [];
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.zip' || ext === '.jar') {
    const { output } = await _run(`unzip -l "${filePath}" 2>/dev/null`);
    results.push({ check: 'ZIP contents', info: output });
  }
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const { output } = await _run(`exiftool "${filePath}" 2>/dev/null | grep -i comment || echo "No hidden data in metadata"`);
    results.push({ check: 'Metadata comments', info: output });
    const data = fs.readFileSync(filePath);
    const iend = data.toString('latin1').lastIndexOf('IEND');
    if (iend > 0) {
      const afterIEND = data.slice(iend + 8);
      if (afterIEND.length > 4) results.push({ check: 'Data after IEND (PNG)', info: `${afterIEND.length} bytes found after IEND chunk` });
    }
  }
  if (results.length === 0) results.push({ check: 'No hidden data detected', info: 'No obvious hidden data found.' });
  return results.map(r => `${r.check}: ${r.info}`).join('\n');
}

async function entropy(filePath) {
  const data = fs.readFileSync(filePath);
  const freq = new Array(256).fill(0);
  for (const b of data) freq[b]++;
  let ent = 0;
  for (const f of freq) {
    if (f > 0) {
      const p = f / data.length;
      ent -= p * Math.log2(p);
    }
  }
  const maxEnt = 8;
  return `Entropy: ${ent.toFixed(4)} (max: ${maxEnt})\nFile size: ${data.length} bytes\nInterpretation: ${ent > 7 ? 'High (likely encrypted/compressed)' : ent > 6 ? 'Moderately high' : ent > 4 ? 'Medium' : 'Low (plain text/repetitive)'}`;
}

async function signature(filePath) {
  const data = fs.readFileSync(filePath);
  const sigs = {
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
    'ca fe ba be': 'Java class / Mach-O',
    'ce fa ed fe': 'Mach-O (reverse)',
    'cffaedfe': 'Mach-O 64-bit',
    '000001ba': 'MPEG program stream',
    '494433': 'MP3 audio (ID3v2)',
    '49492a00': 'TIFF image (little-endian)',
    '4d4d002a': 'TIFF image (big-endian)',
    '424d': 'BMP image',
    '47494638': 'GIF image',
    '52494646': 'RIFF / WAV / AVI',
    '2321': 'Shebang script',
  };
  const hex = data.slice(0, 16).toString('hex').toLowerCase();
  const results = [];
  for (const [magic, desc] of Object.entries(sigs)) {
    if (hex.startsWith(magic)) results.push(desc);
  }
  const { output } = await _run(`file "${filePath}"`);
  return `Detected: ${results.join(', ') || 'Unknown'}\nFile output: ${output.trim()}\nMagic bytes (hex): ${hex.match(/.{2}/g).join(' ')}`;
}

async function yara(filePath) {
  const { output } = await _run(`yara -w /usr/share/yara-rules/*.yar "${filePath}" 2>/dev/null || yara -w /etc/yara/*.yar "${filePath}" 2>/dev/null || echo "YARA not configured. Install yara and rules."`);
  return output;
}

async function zipAnalyze(filePath) {
  const { output } = await _run(`unzip -l "${filePath}" 2>/dev/null`);
  if (output.includes('not found') || !output.trim()) {
    return 'Not a valid ZIP archive or unzip not available.';
  }
  const stat = fs.statSync(filePath);
  let info = `ZIP file size: ${(stat.size / 1024).toFixed(2)} KB\n`;
  info += `Files in archive:\n${output}`;
  return info;
}

async function pcap(filePath) {
  const { output } = await _run(`tcpdump -r "${filePath}" -nn 2>/dev/null | head -100 || tshark -r "${filePath}" -T fields -e frame.number -e ip.src -e ip.dst -e frame.protocols 2>/dev/null | head -100 || echo "pcap/tcpdump not available"`);
  const stat = fs.statSync(filePath);
  return `PCAP file: ${(stat.size / 1024).toFixed(2)} KB\nPackets:\n${output}`;
}

async function binwalk(filePath) {
  const { output } = await _run(`binwalk "${filePath}" 2>/dev/null || echo "binwalk not installed"`);
  return output;
}

async function allAnalysis(filePath) {
  const results = [];
  results.push('=== SIGNATURE ===\n' + (await signature(filePath)));
  results.push('\n=== ENTROPY ===\n' + (await entropy(filePath)));
  results.push('\n=== METADATA ===\n' + (await metadata(filePath)).extra);
  results.push('\n=== STRINGS (first 500) ===\n' + (await strings(filePath)).strings.slice(0, 5000));
  results.push('\n=== HIDDEN ===\n' + (await hidden(filePath)));
  const zipRes = await zipAnalyze(filePath);
  if (!zipRes.startsWith('Not')) results.push('\n=== ZIP ===\n' + zipRes);
  const binRes = await binwalk(filePath);
  if (!binRes.includes('not installed')) results.push('\n=== BINWALK ===\n' + binRes);
  return results.join('\n');
}

async function execute(socket, data) {
  const { command, file: fileBase64, fileName } = data;
  if (!command) return socket.emit('ctf-output', { type: 'error', output: '[!] No command specified' });

  let filePath = null;
  if (fileBase64) {
    const ext = path.extname(fileName || 'file.bin') || '.bin';
    filePath = _saveFile(Buffer.from(fileBase64, 'base64'), ext);
  } else {
    const parts = command.split(/\s+/);
    const potentialPath = parts[parts.length - 1];
    if (potentialPath && fs.existsSync(potentialPath)) {
      filePath = potentialPath;
    }
  }

  try {
    let output = '';
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'metadata': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = JSON.stringify(await metadata(filePath), null, 2);
        break;
      }
      case 'exif': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await exif(filePath);
        break;
      }
      case 'strings': {
        if (!filePath) { output = '[!] No file provided'; break; }
        const s = await strings(filePath);
        output = `Total unique strings: ${s.total}\n\n${s.strings}`;
        break;
      }
      case 'hidden': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await hidden(filePath);
        break;
      }
      case 'entropy': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await entropy(filePath);
        break;
      }
      case 'signature': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await signature(filePath);
        break;
      }
      case 'yara': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await yara(filePath);
        break;
      }
      case 'zip': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await zipAnalyze(filePath);
        break;
      }
      case 'pcap': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await pcap(filePath);
        break;
      }
      case 'binwalk': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await binwalk(filePath);
        break;
      }
      case 'all': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await allAnalysis(filePath);
        break;
      }
      default:
        output = `[!] Unknown forensic command: ${cmd}`;
    }

    socket.emit('ctf-output', { type: 'result', output, category: 'forensic', command });
  } catch (err) {
    socket.emit('ctf-output', { type: 'error', output: `[!] ${err.message}`, category: 'forensic', command });
  } finally {
    if (filePath && filePath.startsWith(TEMP_DIR)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
}

module.exports = { execute, TEMP_DIR };
