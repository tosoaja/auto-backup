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

function _pattern(length) {
  const c = 'abcdefghijklmnopqrstuvwxyz';
  let pat = '';
  for (let i = 0; pat.length < length; i++) {
    pat += c[Math.floor(i / 26 / 26) % 26];
    if (pat.length >= length) break;
    pat += c[Math.floor(i / 26) % 26];
    if (pat.length >= length) break;
    pat += c[i % 26];
  }
  return pat.slice(0, length);
}

function _offset(value, length = 8192) {
  const pat = _pattern(length);
  const idx = pat.indexOf(value);
  if (idx >= 0) return `Offset: ${idx} (0x${idx.toString(16)})`;
  const hexPat = Buffer.from(pat).toString('hex');
  const hexIdx = hexPat.indexOf(value);
  if (hexIdx >= 0) return `Offset: ${hexIdx / 2} (0x${(hexIdx / 2).toString(16)}) [hex match]`;
  return 'Not found in cyclic pattern. Try a different value or longer pattern.';
}

async function _elfInfo(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 4).toString() !== '\x7fELF') return 'Not a valid ELF binary';
  const bits = data[4] === 1 ? 32 : data[4] === 2 ? 64 : 'Unknown';
  const endian = data[5] === 1 ? 'Little Endian' : 'Big Endian';
  const osabi = ['System V', 'HP-UX', 'NetBSD', 'Linux', 'GNU Hurd', 'Solaris', 'AIX', 'IRIX', 'FreeBSD', 'Tru64', 'Novell Modesto', 'OpenBSD', 'OpenVMS', 'NonStop Kernel', 'AROS', 'Fenix OS', 'CloudABI', 'Stratus Technologies OpenVOS'];
  const os = data[7] < osabi.length ? osabi[data[7]] : 'Unknown';
  const types = ['NONE', 'REL (Relocatable)', 'EXEC (Executable)', 'DYN (Shared Object)', 'CORE (Core file)'];
  const type = data[16] < types.length ? types[data[16]] : 'Unknown';
  let arch = 'Unknown';
  if (data[18] === 0x00 && data[19] === 0x00) { }
  const machine = { 0x02: 'SPARC', 0x03: 'x86', 0x08: 'MIPS', 0x14: 'PowerPC', 0x16: 'S390', 0x28: 'ARM', 0x2A: 'SuperH', 0x32: 'IA-64', 0x3E: 'x86-64', 0xB7: 'AArch64', 0xF3: 'RISC-V' };
  arch = machine[data[19]] || machine[data[18]] || 'Unknown';

  const { output: fileOut } = await _run(`file "${filePath}"`);
  const { output: checksec } = await _run(`checksec --file="${filePath}" 2>/dev/null || readelf -l "${filePath}" 2>/dev/null | grep -i stack | head -5 || echo "checksec not available"`);

  return `File: ${path.basename(filePath)}
Type: ${type}
Bits: ${bits}-bit
Endian: ${endian}
OS/ABI: ${os}
Architecture: ${arch}
File info: ${fileOut.trim()}
Security: ${checksec.trim() || 'N/A'}`;
}

async function _ropGadgets(filePath) {
  const { output } = await _run(`ROPgadget --binary "${filePath}" 2>/dev/null | head -100 || echo "ROPgadget not installed"`);
  return output;
}

function _shellcode(type) {
  const sc = {
    'linux-x86-exec': Buffer.from([0x31, 0xc0, 0x50, 0x68, 0x2f, 0x2f, 0x73, 0x68, 0x68, 0x2f, 0x62, 0x69, 0x6e, 0x89, 0xe3, 0x50, 0x53, 0x89, 0xe1, 0x31, 0xd2, 0x31, 0xc0, 0xb0, 0x0b, 0xcd, 0x80]).toString('hex'),
    'linux-x64-exec': Buffer.from([0x31, 0xf6, 0x48, 0xbb, 0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x73, 0x68, 0x00, 0x56, 0x53, 0x54, 0x5f, 0x6a, 0x3b, 0x58, 0x31, 0xd2, 0x0f, 0x05]).toString('hex'),
    'linux-x64-reverse': 'shellcode for reverse shell would go here',
    'windows-x86-exec': 'shellcode for Windows would go here',
  };
  const scType = type || 'linux-x64-exec';
  if (sc[scType]) {
    const hex = sc[scType];
    const bytes = hex.match(/.{2}/g).map(b => '\\x' + b).join('');
    return `Type: ${scType}
Length: ${hex.length / 2} bytes

Hex:
${hex}

Shellcode:
"${bytes}"

Assembly:
$ echo -n '${hex}' | xxd -r -p | ndisasm -b 64 -`;
  }
  return `Unknown shellcode type: ${type}\nAvailable: ${Object.keys(sc).join(', ')}`;
}

function _template(binary) {
  return `#!/usr/bin/env python3
from pwn import *

# Target
binary_path = '${binary}'
elf = ELF(binary_path)

# Connection (change as needed)
# p = process(binary_path)
# p = remote('host', port)

# Exploit here
# payload = flat({
#     offset: address
# })

# p.interactive()
`;
}

async function checksec(filePath) {
  const { output } = await _run(`checksec --file="${filePath}" 2>/dev/null || readelf -l "${filePath}" 2>/dev/null | head -30 || objdump -p "${filePath}" 2>/dev/null | head -30 || echo "No binary analysis tools available"`);
  return output;
}

async function asm(instructions) {
  const asmCode = instructions || 'nop';
  const fp = path.join(TEMP_DIR, `asm_${Date.now()}.s`);
  fs.writeFileSync(fp, `.intel_syntax noprefix\n${asmCode}\n`);
  const { output } = await _run(`as -o "${fp}.o" "${fp}" 2>/dev/null && objdump -d "${fp}.o" 2>/dev/null | grep -v 'file format' | tail -n +3 || echo "Assembly failed"`);
  try { fs.unlinkSync(fp); fs.unlinkSync(fp + '.o'); } catch {}
  return output;
}

async function execute(socket, data) {
  const { command, file: fileBase64, fileName } = data;
  if (!command) return socket.emit('ctf-output', { type: 'error', output: '[!] No command specified', category: 'pwn' });

  let filePath = null;
  if (fileBase64) {
    const ext = path.extname(fileName || 'binary') || '.bin';
    filePath = path.join(TEMP_DIR, `pwn_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    fs.writeFileSync(filePath, Buffer.from(fileBase64, 'base64'));
    fs.chmodSync(filePath, 0o755);
  }

  try {
    let output = '';
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'pattern': {
        const len = parseInt(args[0]) || 256;
        output = _pattern(len);
        break;
      }
      case 'offset': {
        const val = args[0] || '';
        const len = parseInt(args[1]) || 1024;
        output = _offset(val, len);
        break;
      }
      case 'elf': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await _elfInfo(filePath);
        break;
      }
      case 'rop': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await _ropGadgets(filePath);
        break;
      }
      case 'shellcode': {
        output = _shellcode(args[0]);
        break;
      }
      case 'template': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = _template(filePath);
        break;
      }
      case 'checksec': {
        if (!filePath) { output = '[!] No file provided'; break; }
        output = await checksec(filePath);
        break;
      }
      case 'asm': {
        output = await asm(args.join(' '));
        break;
      }
      default:
        output = `[!] Unknown pwn command: ${cmd}`;
    }

    socket.emit('ctf-output', { type: 'result', output, category: 'pwn', command });
  } catch (err) {
    socket.emit('ctf-output', { type: 'error', output: `[!] ${err.message}`, category: 'pwn', command });
  } finally {
    if (filePath && filePath.startsWith(TEMP_DIR)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
}

module.exports = { execute };
