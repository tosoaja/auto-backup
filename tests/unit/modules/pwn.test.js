const pattern = require('../../../src/modules/pwn/commands/pattern');
const offset = require('../../../src/modules/pwn/commands/offset');
const shellcode = require('../../../src/modules/pwn/commands/shellcode');

describe('pwn/pattern', () => {
  it('should generate cyclic pattern of default length', () => {
    const r = pattern({ args: [] });
    expect(r).toHaveLength(256);
    expect(r).toMatch(/^[a-z]+$/);
  });

  it('should generate pattern of specified length', () => {
    const r = pattern({ args: ['100'] });
    expect(r).toHaveLength(100);
  });

  it('should generate pattern of length 32', () => {
    const r = pattern({ args: ['32'] });
    expect(r).toHaveLength(32);
  });

  it('should consistently produce same pattern for same length', () => {
    const r1 = pattern({ args: ['50'] });
    const r2 = pattern({ args: ['50'] });
    expect(r1).toBe(r2);
  });
});

describe('pwn/offset', () => {
  it('should find offset for a value in the pattern', () => {
    const pat = pattern({ args: ['256'] });
    const val = pat.slice(0, 4);
    const r = offset({ args: [val] });
    expect(r).toContain('Offset:');
    expect(r).toContain('0x');
  });

  it('should return not found for unknown value', () => {
    const r = offset({ args: ['zzzz'] });
    expect(r).toContain('Not found');
  });

  it('should return usage for empty input', () => {
    const r = offset({ args: [] });
    expect(r).toContain('Usage');
  });
});

describe('pwn/shellcode', () => {
  it('should return linux-x64-exec shellcode', () => {
    const r = shellcode({ args: ['linux-x64-exec'] });
    expect(r).toContain('Type: linux-x64-exec');
    expect(r).toContain('\\x');
    expect(r).toContain('Hex:');
  });

  it('should return linux-x86-exec shellcode', () => {
    const r = shellcode({ args: ['linux-x86-exec'] });
    expect(r).toContain('Type: linux-x86-exec');
    expect(r).toContain('Length:');
  });

  it('should return error for unknown type', () => {
    const r = shellcode({ args: ['unknown-type'] });
    expect(r).toContain('Unknown shellcode type');
  });

  it('should default to linux-x64-exec', () => {
    const r = shellcode({ args: [] });
    expect(r).toContain('linux-x64-exec');
  });
});
