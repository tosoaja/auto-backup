const fs = require('fs');
const path = require('path');
const os = require('os');
const opcode = require('../../../src/modules/reverse/commands/opcode');
const packer = require('../../../src/modules/reverse/commands/packer');

describe('reverse/opcode', () => {
  let tmpFile;

  afterEach(() => {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch {} tmpFile = null; }
  });

  it('should compute byte frequencies', () => {
    tmpFile = path.join(os.tmpdir(), 'opcode-test.bin');
    fs.writeFileSync(tmpFile, Buffer.from([0x00, 0x01, 0x02, 0x00, 0x01, 0x00]));
    const r = opcode({ filePath: tmpFile });
    expect(r).toContain('File size: 6 bytes');
    expect(r).toContain('0x00');
    expect(r).toContain('50.00%');
  });

  it('should handle single-byte file', () => {
    tmpFile = path.join(os.tmpdir(), 'opcode-single.bin');
    fs.writeFileSync(tmpFile, Buffer.from([0xff]));
    const r = opcode({ filePath: tmpFile });
    expect(r).toContain('File size: 1 bytes');
    expect(r).toContain('0xff: 1');
    expect(r).toContain('100.00%');
  });

  it('should show top 30 bytes', () => {
    tmpFile = path.join(os.tmpdir(), 'opcode-many.bin');
    const buf = Buffer.alloc(100);
    for (let i = 0; i < 100; i++) buf[i] = i % 3;
    fs.writeFileSync(tmpFile, buf);
    const r = opcode({ filePath: tmpFile });
    const lines = r.split('\n');
    expect(lines.length).toBeGreaterThan(2);
  });
});

describe('reverse/packer', () => {
  let tmpFile;

  afterEach(() => {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch {} tmpFile = null; }
  });

  it('should detect UPX signature', () => {
    tmpFile = path.join(os.tmpdir(), 'packer-upx.bin');
    fs.writeFileSync(tmpFile, 'some data with UPX in it');
    const r = packer({ filePath: tmpFile });
    expect(r).toContain('UPX');
  });

  it('should detect ASPack signature', () => {
    tmpFile = path.join(os.tmpdir(), 'packer-aspack.bin');
    fs.writeFileSync(tmpFile, 'some data with ASPack here');
    const r = packer({ filePath: tmpFile });
    expect(r).toContain('ASPack');
  });

  it('should report no known packer for plain text', () => {
    tmpFile = path.join(os.tmpdir(), 'packer-plain.bin');
    const buf = Buffer.alloc(100);
    for (let i = 0; i < 100; i++) buf[i] = 0x41 + (i % 26);
    fs.writeFileSync(tmpFile, buf);
    const r = packer({ filePath: tmpFile });
    expect(r).toContain('No known packer');
  });

  it('should detect high entropy as possible packing', () => {
    tmpFile = path.join(os.tmpdir(), 'packer-entropy.bin');
    const buf = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) buf[i] = i;
    fs.writeFileSync(tmpFile, buf);
    const r = packer({ filePath: tmpFile });
    expect(r).toContain('packing');
  });

  it('should detect Themida', () => {
    tmpFile = path.join(os.tmpdir(), 'packer-themida.bin');
    fs.writeFileSync(tmpFile, 'protected with WinLicense');
    const r = packer({ filePath: tmpFile });
    expect(r).toContain('Themida');
  });
});
