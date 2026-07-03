const fs = require('fs');
const path = require('path');
const os = require('os');
const entropy = require('../../../src/modules/forensic/commands/entropy');
const signature = require('../../../src/modules/forensic/commands/signature');

describe('forensic/entropy', () => {
  let tmpFile;

  afterEach(() => {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch {} tmpFile = null; }
  });

  it('should calculate low entropy for repetitive data', () => {
    tmpFile = path.join(os.tmpdir(), 'entropy-low.bin');
    fs.writeFileSync(tmpFile, Buffer.alloc(1024, 0x41));
    const r = entropy({ filePath: tmpFile });
    expect(r).toContain('Entropy:');
    expect(r).toContain('Low');
  });

  it('should calculate high entropy for random data', () => {
    tmpFile = path.join(os.tmpdir(), 'entropy-high.bin');
    const buf = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) buf[i] = i;
    fs.writeFileSync(tmpFile, buf);
    const r = entropy({ filePath: tmpFile });
    expect(r).toContain('Entropy:');
    expect(parseFloat(r.split('\n')[0].split(':')[1].trim())).toBeGreaterThan(7);
  });

  it('should handle empty file', () => {
    tmpFile = path.join(os.tmpdir(), 'entropy-empty.bin');
    fs.writeFileSync(tmpFile, '');
    const r = entropy({ filePath: tmpFile });
    expect(r).toContain('File size: 0 bytes');
  });
});

describe('forensic/signature', () => {
  let tmpFile;

  afterEach(() => {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch {} tmpFile = null; }
  });

  it('should detect PNG signature', async () => {
    tmpFile = path.join(os.tmpdir(), 'test.png');
    const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const rest = Buffer.alloc(20, 0);
    fs.writeFileSync(tmpFile, Buffer.concat([pngSig, rest]));
    const r = await signature({ filePath: tmpFile });
    expect(r).toContain('PNG');
  });

  it('should detect ELF signature', async () => {
    tmpFile = path.join(os.tmpdir(), 'test.elf');
    const elfSig = Buffer.from([0x7F, 0x45, 0x4C, 0x46]);
    const rest = Buffer.alloc(20, 0);
    fs.writeFileSync(tmpFile, Buffer.concat([elfSig, rest]));
    const r = await signature({ filePath: tmpFile });
    expect(r).toContain('ELF');
  });

  it('should detect PE signature', async () => {
    tmpFile = path.join(os.tmpdir(), 'test.exe');
    const peSig = Buffer.from([0x4D, 0x5A]);
    const rest = Buffer.alloc(20, 0);
    fs.writeFileSync(tmpFile, Buffer.concat([peSig, rest]));
    const r = await signature({ filePath: tmpFile });
    expect(r).toContain('PE');
  });

  it('should return Unknown for unrecognized data', async () => {
    tmpFile = path.join(os.tmpdir(), 'test.unknown');
    fs.writeFileSync(tmpFile, Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]));
    const r = await signature({ filePath: tmpFile });
    expect(r).toContain('Unknown');
  });
});
