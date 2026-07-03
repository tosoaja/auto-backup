const base64 = require('../../../src/modules/crypto/commands/base64');
const hex = require('../../../src/modules/crypto/commands/hex');
const rot13 = require('../../../src/modules/crypto/commands/rot13');
const caesar = require('../../../src/modules/crypto/commands/caesar');
const xor = require('../../../src/modules/crypto/commands/xor');
const hash = require('../../../src/modules/crypto/commands/hash');
const freq = require('../../../src/modules/crypto/commands/freq');
const hashid = require('../../../src/modules/crypto/commands/hashid');

describe('crypto/base64', () => {
  it('should encode to base64 by default', () => {
    const r = base64({ args: ['hello'] });
    expect(r).toBe('aGVsbG8=');
  });

  it('should encode with -e flag', () => {
    const r = base64({ args: ['-e', 'hello'] });
    expect(r).toBe('aGVsbG8=');
  });

  it('should decode with -d flag', () => {
    const r = base64({ args: ['-d', 'aGVsbG8='] });
    expect(r).toBe('hello');
  });

  it('should return usage for no args', () => {
    const r = base64({ args: [] });
    expect(r).toContain('Usage');
  });
});

describe('crypto/hex', () => {
  it('should encode to hex by default', () => {
    const r = hex({ args: ['hello'] });
    expect(r).toBe('68656c6c6f');
  });

  it('should decode from hex with -d', () => {
    const r = hex({ args: ['-d', '68656c6c6f'] });
    expect(r).toBe('hello');
  });
});

describe('crypto/rot13', () => {
  it('should rotate letters by 13', () => {
    const r = rot13({ args: ['hello'] });
    expect(r).toBe('uryyb');
  });

  it('should be its own inverse', () => {
    const r1 = rot13({ args: ['hello world'] });
    const r2 = rot13({ args: [r1] });
    expect(r2).toBe('hello world');
  });

  it('should preserve non-letters', () => {
    const r = rot13({ args: ['hello123!@#'] });
    expect(r).toBe('uryyb123!@#');
  });

  it('should return usage for no args', () => {
    const r = rot13({ args: [] });
    expect(r).toContain('Usage');
  });
});

describe('crypto/caesar', () => {
  it('should shift by 13 by default', () => {
    const r = caesar({ args: ['hello'] });
    expect(r).toBe('uryyb');
  });

  it('should accept custom shift', () => {
    const r = caesar({ args: ['abc', '3'] });
    expect(r).toBe('def');
  });

  it('should handle negative shifts', () => {
    const r = caesar({ args: ['def', '-3'] });
    expect(r).toBe('abc');
  });

  it('should wrap around alphabet', () => {
    const r = caesar({ args: ['xyz', '3'] });
    expect(r).toBe('abc');
  });
});

describe('crypto/xor', () => {
  it('should XOR text with key', () => {
    const r = xor({ args: ['hello', 'key'] });
    expect(r).toContain('Hex:');
    expect(r).toContain('Text:');
  });

  it('should XOR hex input', () => {
    const r = xor({ args: ['68656c6c6f', 'key'] });
    expect(r).toContain('Hex:');
  });

  it('should return usage for missing args', () => {
    const r = xor({ args: ['onlydata'] });
    expect(r).toContain('Usage');
  });
});

describe('crypto/hash', () => {
  it('should compute md5', () => {
    const r = hash({ args: ['md5', 'hello'] });
    expect(r).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('should compute sha256', () => {
    const r = hash({ args: ['sha256', 'hello'] });
    expect(r).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('should return usage for missing args', () => {
    const r = hash({ args: [] });
    expect(r).toContain('Usage');
  });

  it('should return error for unsupported algorithm', () => {
    const r = hash({ args: ['unknown', 'text'] });
    expect(r).toContain('Unsupported');
  });
});

describe('crypto/freq', () => {
  it('should analyze character frequency', () => {
    const r = freq({ args: ['hello world'] });
    expect(r).toContain('Char');
    expect(r).toContain('Count');
    expect(r).toContain('l');
    expect(r).toContain('h');
  });

  it('should handle no letters', () => {
    const r = freq({ args: ['12345'] });
    expect(r).toContain('No letters');
  });

  it('should return usage for no args', () => {
    const r = freq({ args: [] });
    expect(r).toContain('Usage');
  });
});

describe('crypto/hashid', () => {
  it('should identify MD5 hash', () => {
    const r = JSON.parse(hashid({ args: ['5d41402abc4b2a76b9719d911017c592'] }));
    expect(r.possibleTypes.some(t => t.name === 'MD5')).toBe(true);
    expect(r.length).toBe(32);
  });

  it('should identify SHA256 hash', () => {
    const r = JSON.parse(hashid({ args: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'] }));
    expect(r.possibleTypes.some(t => t.name === 'SHA256')).toBe(true);
    expect(r.length).toBe(64);
  });

  it('should identify bcrypt hash', () => {
    const r = JSON.parse(hashid({ args: ['$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1'] }));
    expect(r.possibleTypes.some(t => t.name.startsWith('bcrypt'))).toBe(true);
  });

  it('should return unknown for unrecognized', () => {
    const r = JSON.parse(hashid({ args: ['zzzz'] }));
    expect(r.possibleTypes[0].name).toContain('Unknown');
  });
});
