const identify = require('../../../src/modules/hashid/commands/identify');

describe('hashid/identify', () => {
  it('should identify MD5', () => {
    const r = identify({ args: ['5d41402abc4b2a76b9719d911017c592'] });
    expect(r.hash).toBe('5d41402abc4b2a76b9719d911017c592');
    expect(r.length).toBe(32);
    expect(r.possibleTypes.some(t => t.name === 'MD5')).toBe(true);
  });

  it('should identify SHA1', () => {
    const r = identify({ args: ['a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'] });
    expect(r.possibleTypes.some(t => t.name === 'SHA1')).toBe(true);
  });

  it('should identify SHA256', () => {
    const r = identify({ args: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'] });
    expect(r.possibleTypes.some(t => t.name === 'SHA256')).toBe(true);
  });

  it('should identify SHA512', () => {
    const r = identify({ args: ['cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'] });
    expect(r.possibleTypes.some(t => t.name === 'SHA512')).toBe(true);
  });

  it('should identify bcrypt', () => {
    const r = identify({ args: ['$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1'] });
    expect(r.possibleTypes.some(t => t.name === 'Bcrypt')).toBe(true);
  });

  it('should identify NTLM (hex 32)', () => {
    const r = identify({ args: ['5d41402abc4b2a76b9719d911017c592'] });
    expect(r.possibleTypes.some(t => t.name === 'NTLM')).toBe(true);
  });

  it('should handle empty hash', () => {
    const r = identify({ args: [] });
    expect(r).toContain('Usage');
  });
});
