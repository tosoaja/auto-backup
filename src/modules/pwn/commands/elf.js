const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
module.exports = async function elf({ filePath }) {
  const data = fs.readFileSync(filePath);
  if (data.slice(0, 4).toString() !== '\x7fELF') return 'Not a valid ELF binary';
  const bits = data[4] === 1 ? 32 : data[4] === 2 ? 64 : 'Unknown';
  const endian = data[5] === 1 ? 'Little Endian' : 'Big Endian';
  const osabi = ['System V', 'HP-UX', 'NetBSD', 'Linux', 'GNU Hurd', 'Solaris', 'AIX', 'IRIX', 'FreeBSD', 'Tru64', 'OpenBSD', 'OpenVMS'];
  const os = data[7] < osabi.length ? osabi[data[7]] : 'Unknown';
  const types = ['NONE', 'REL (Relocatable)', 'EXEC (Executable)', 'DYN (Shared Object)', 'CORE (Core file)'];
  const type = data[16] < types.length ? types[data[16]] : 'Unknown';
  const machine = { 0x02: 'SPARC', 0x03: 'x86', 0x08: 'MIPS', 0x14: 'PowerPC', 0x16: 'S390', 0x28: 'ARM', 0x3E: 'x86-64', 0xB7: 'AArch64', 0xF3: 'RISC-V' };
  const arch = machine[data[19]] || machine[data[18]] || 'Unknown';
  return new Promise((resolve) => {
    exec(`file "${filePath}"`, { timeout: 5000 }, (e, stdout) => {
      resolve(`File: ${path.basename(filePath)}\nType: ${type}\nBits: ${bits}-bit\nEndian: ${endian}\nOS/ABI: ${os}\nArchitecture: ${arch}\nFile info: ${(stdout || '').trim()}`);
    });
  });
};