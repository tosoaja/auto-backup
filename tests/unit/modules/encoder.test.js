const encode = require('../../../src/modules/encoder/commands/encode');
const decode = require('../../../src/modules/encoder/commands/decode');
const list = require('../../../src/modules/encoder/commands/list');

describe('encoder/encode', () => {
  it('should encode base64', () => {
    const r = encode({ args: ['base64', 'hello'] });
    expect(r).toBe('aGVsbG8=');
  });

  it('should encode hex', () => {
    const r = encode({ args: ['hex', 'hello'] });
    expect(r).toBe('68656c6c6f');
  });

  it('should encode URL', () => {
    const r = encode({ args: ['url', 'hello world'] });
    expect(r).toBe('hello%20world');
  });

  it('should encode rot13', () => {
    const r = encode({ args: ['rot13', 'hello'] });
    expect(r).toBe('uryyb');
  });

  it('should encode reverse', () => {
    const r = encode({ args: ['reverse', 'hello'] });
    expect(r).toBe('olleh');
  });

  it('should return usage for no args', () => {
    const r = encode({ args: [] });
    expect(r).toContain('Usage');
  });

  it('should return usage for missing args', () => {
    const r = encode({ args: null });
    expect(r).toContain('Usage');
  });

  it('should return error for unsupported type', () => {
    const r = encode({ args: ['invalid', 'text'] });
    expect(r).toContain('Unsupported');
  });
});

describe('encoder/decode', () => {
  it('should decode base64', () => {
    const r = decode({ args: ['base64', 'aGVsbG8='] });
    expect(r).toBe('hello');
  });

  it('should decode hex', () => {
    const r = decode({ args: ['hex', '68656c6c6f'] });
    expect(r).toBe('hello');
  });

  it('should decode URL', () => {
    const r = decode({ args: ['url', 'hello%20world'] });
    expect(r).toBe('hello world');
  });

  it('should decode rot13', () => {
    const r = decode({ args: ['rot13', 'uryyb'] });
    expect(r).toBe('hello');
  });

  it('should handle decode gracefully even with unusual input', () => {
    const r = decode({ args: ['hex', 'abcdef'] });
    expect(typeof r).toBe('string');
  });

  it('should return usage for no args', () => {
    const r = decode({ args: [] });
    expect(r).toContain('Usage');
  });
});

describe('encoder/list', () => {
  it('should list supported types', () => {
    const r = list();
    expect(r).toContain('base64');
    expect(r).toContain('hex');
    expect(r).toContain('rot13');
    expect(r).toContain('reverse');
    expect(r).toContain('Usage');
  });
});
