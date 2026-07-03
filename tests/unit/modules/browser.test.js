const open = require('../../../src/modules/browser/commands/open');

describe('browser/open', () => {
  it('should return success message with URL', () => {
    const r = open({ args: ['http://example.com'] });
    expect(r).toContain('Opened');
    expect(r).toContain('http://example.com');
  });

  it('should return usage for empty args', () => {
    const r = open({ args: [] });
    expect(r).toContain('Usage');
  });

  it('should return usage for null args', () => {
    const r = open({ args: null });
    expect(r).toContain('Usage');
  });
});
