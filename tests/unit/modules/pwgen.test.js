const generate = require('../../../src/modules/pwgen/commands/generate');

describe('pwgen/generate', () => {
  it('should generate a password with default options', () => {
    const r = generate({ args: ['--count', '1', '--length', '16'] });
    expect(r.passwords).toHaveLength(1);
    expect(r.passwords[0]).toHaveLength(16);
    expect(r.count).toBe(1);
    expect(r.length).toBe(16);
    expect(r.entropy).toBeGreaterThan(0);
    expect(r.strength).toBeDefined();
  });

  it('should generate multiple passwords', () => {
    const r = generate({ args: ['--count', '5', '--length', '12'] });
    expect(r.passwords).toHaveLength(5);
    r.passwords.forEach(p => expect(p).toHaveLength(12));
  });

  it('should exclude symbols with --nosymbols', () => {
    const r = generate({ args: ['--count', '1', '--length', '32', '--nosymbols'] });
    r.passwords[0].split('').forEach(c => {
      expect(c).not.toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~]/);
    });
  });

  it('should exclude similar chars with --nosimilar', () => {
    const r = generate({ args: ['--count', '100', '--length', '64', '--nosimilar'] });
    r.passwords.forEach(p => {
      expect(p).not.toMatch(/[il1Lo0O]/);
    });
  });

  it('should work with --noupper --nolower', () => {
    const r = generate({ args: ['--count', '1', '--length', '8', '--noupper', '--nolower', '--nonumbers'] });
    expect(r.passwords[0]).toMatch(/^[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~]+$/);
  });
});
