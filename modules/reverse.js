const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', 'temp_ctf');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function _run(cmd, timeout = 30000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve((stdout || stderr || '').slice(0, 50000));
    });
  });
}

async function peInfo(filePath) {
  const { output } = await _run(`exiftool "${filePath}" 2>/dev/null | head -40 || file "${filePath}"`);
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 2).toString() !== 'MZ') return 'Not a valid PE (Portable Executable) file.\n' + output;
  let info = `File: ${path.basename(filePath)}\nSize: ${(data.length / 1024).toFixed(2)} KB\n`;
  const peOffset = data.readUInt32LE(0x3C);
  info += `PE header offset: 0x${peOffset.toString(16)}\n`;
  if (peOffset < data.length && data.slice(peOffset, peOffset + 2).toString() === 'PE') {
    const machine = { 0x14c: 'x86', 0x8664: 'x64', 0x1c0: 'ARM', 0xaa64: 'ARM64', 0x200: 'Itanium' };
    const mach = data.readUInt16LE(peOffset + 4);
    info += `Machine: ${machine[mach] || '0x' + mach.toString(16)}\n`;
    const sections = data.readUInt16LE(peOffset + 6);
    info += `Sections: ${sections}\n`;
    const characteristics = data.readUInt16LE(peOffset + 22);
    info += `Characteristics: 0x${characteristics.toString(16)}\n`;
  }
  info += '\n' + output;
  return info;
}

async function elfInfo(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 4).toString() !== '\x7fELF') {
    const { output } = await _run(`file "${filePath}"`);
    return 'Not a valid ELF binary.\n' + output;
  }
  const { output } = await _run(`readelf -h "${filePath}" 2>/dev/null || elfdump "${filePath}" 2>/dev/null || file "${filePath}"`);
  return output;
}

async function strings(filePath, minLen = 5) {
  const { output: strOutput } = await _run(`strings -n ${minLen} "${filePath}" 2>/dev/null | sort | uniq | head -500`);
  const { output: fileOut } = await _run(`file "${filePath}"`);
  const stat = fs.statSync(filePath);
  const lines = strOutput.split('\n').filter(l => l.trim());
  return `File: ${path.basename(filePath)} (${(stat.size / 1024).toFixed(2)} KB)
Type: ${fileOut.trim()}
Total strings: ${lines.length}

${strOutput}`;
}

async function disasm(filePath) {
  const { output } = await _run(`objdump -d "${filePath}" 2>/dev/null | head -200 || ndisasm -b 64 "${filePath}" 2>/dev/null | head -200 || echo "No disassembler available"`);
  return output;
}

async function opcodeStats(filePath) {
  const data = fs.readFileSync(filePath);
  const freq = {};
  for (const b of data) freq[b] = (freq[b] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30);
  let output = `File size: ${data.length} bytes\nTop opcode/byte frequencies:\n`;
  output += sorted.map(([k, v]) => `  0x${parseInt(k).toString(16).padStart(2, '0')}: ${v} (${(v / data.length * 100).toFixed(2)}%)`).join('\n');
  return output;
}

async function sections(filePath) {
  const { output } = await _run(`readelf -S "${filePath}" 2>/dev/null || objdump -h "${filePath}" 2>/dev/null || dumpbin -headers "${filePath}" 2>/dev/null || echo "Section analysis not available"`);
  return output;
}

async function imports(filePath) {
  const { output } = await _run(`objdump -T "${filePath}" 2>/dev/null | head -100 || nm -D "${filePath}" 2>/dev/null | head -100 || readelf -s "${filePath}" 2>/dev/null | head -100 || echo "Import analysis not available"`);
  return output;
}

async function exports(filePath) {
  const { output } = await _run(`nm -D "${filePath}" 2>/dev/null | head -100 || objdump -T "${filePath}" 2>/dev/null | grep -i ' DF ' | head -100 || echo "Export analysis not available"`);
  return output;
}

async function packerDetect(filePath) {
  const data = fs.readFileSync(filePath);
  const results = [];
  const strContent = data.toString('latin1').toLowerCase();
  const packerSigs = [
    { name: 'UPX', sig: /upx/i },
    { name: 'ASPack', sig: /aspack/i },
    { name: 'PECompact', sig: /pecompact/i },
    { name: 'Armadillo', sig: /armadillo/i },
    { name: 'Themida', sig: /themida|winlicense/i },
    { name: 'VMProtect', sig: /vmp\d|vmprotect/i },
    { name: 'Enigma', sig: /enigma\sprotector/i },
    { name: 'MPRESS', sig: /mpress/i },
    { name: 'FSG', sig: /fsg!/i },
  ];
  for (const p of packerSigs) {
    if (p.sig.test(strContent)) results.push(p.name);
  }
  if (results.length === 0) {
    const entropy = data.length > 0 ? (() => {
      const freq = new Array(256).fill(0);
      for (const b of data) freq[b]++;
      let ent = 0;
      for (const f of freq) { if (f > 0) { const p = f / data.length; ent -= p * Math.log2(p); } }
      return ent;
    })() : 0;
    if (entropy > 7) results.push('High entropy - possible packing/encryption');
    else results.push('No known packer detected');
  }
  return `Packer detection for: ${path.basename(filePath)}\n\nDetected: ${results.join(', ') || 'None'}`;
}

async function allReverse(filePath) {
  const results = [];
  results.push('=== FILE INFO ===\n' + await _run(`file "${filePath}"`));
  results.push('\n=== SECTIONS ===\n' + await sections(filePath));
  results.push('\n=== IMPORTS ===\n' + await imports(filePath));
  results.push('\n=== STRINGS ===\n' + (await strings(filePath, 6)));
  results.push('\n=== PACKER ===\n' + await packerDetect(filePath));
  results.push('\n=== OPCODE STATS ===\n' + await opcodeStats(filePath));
  return results.join('\n');
}

async function execute(socket, data) {
  const { command, file: fileBase64, fileName } = data;
  if (!command) return socket.emit('ctf-output', { type: 'error', output: '[!] No command specified', category: 'reverse' });

  let filePath = null;
  if (fileBase64) {
    const ext = path.extname(fileName || 'binary') || '.bin';
    filePath = path.join(TEMP_DIR, `rev_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    fs.writeFileSync(filePath, Buffer.from(fileBase64, 'base64'));
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
      case 'pe': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await peInfo(filePath);
        break;
      }
      case 'elf': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await elfInfo(filePath);
        break;
      }
      case 'strings': {
        if (!filePath) { output = '[!] No file provided'; break; }
        const minLen = parseInt(parts[1]) || 5;
        output = await strings(filePath, minLen);
        break;
      }
      case 'disasm': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await disasm(filePath);
        break;
      }
      case 'opcode': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await opcodeStats(filePath);
        break;
      }
      case 'sections': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await sections(filePath);
        break;
      }
      case 'imports': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await imports(filePath);
        break;
      }
      case 'exports': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await exports(filePath);
        break;
      }
      case 'packer': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await packerDetect(filePath);
        break;
      }
      case 'all': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await allReverse(filePath);
        break;
      }
      default:
        output = `[!] Unknown reverse command: ${cmd}`;
    }

    socket.emit('ctf-output', { type: 'result', output, category: 'reverse', command });
  } catch (err) {
    socket.emit('ctf-output', { type: 'error', output: `[!] ${err.message}`, category: 'reverse', command });
  } finally {
    if (filePath && filePath.startsWith(TEMP_DIR)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
}

module.exports = { execute };
