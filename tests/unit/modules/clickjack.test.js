const axios = require('axios');

jest.mock('axios');

const test = require('../../../src/modules/clickjack/commands/test');

describe('clickjack/test', () => {
  beforeEach(() => {
    axios.create.mockClear();
  });

  it('should detect vulnerable site (no X-Frame-Options)', async () => {
    const mockInstance = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        headers: {}
      })
    };
    axios.create.mockReturnValue(mockInstance);

    const r = await test({ args: ['http://example.com'] });
    expect(r.url).toBe('http://example.com');
    expect(r.vulnerable).toBe(true);
    expect(r.verdict).toContain('VULNERABLE');
    expect(r.details.some(d => d.check === 'X-Frame-Options' && d.status === 'FAIL')).toBe(true);
    expect(r.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect protected site (with X-Frame-Options)', async () => {
    const mockInstance = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        headers: {
          'x-frame-options': 'DENY',
          'content-security-policy': "frame-ancestors 'none'"
        }
      })
    };
    axios.create.mockReturnValue(mockInstance);

    const r = await test({ args: ['https://secure.example.com'] });
    expect(r.vulnerable).toBe(false);
    expect(r.verdict).toContain('PROTECTED');
    expect(r.details.some(d => d.check === 'X-Frame-Options' && d.status === 'PASS')).toBe(true);
  });

  it('should handle missing https prefix', async () => {
    const mockInstance = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        headers: {}
      })
    };
    axios.create.mockReturnValue(mockInstance);

    const r = await test({ args: ['example.com'] });
    expect(r.url).toBe('https://example.com');
  });

  it('should handle errors gracefully', async () => {
    const mockInstance = {
      get: jest.fn().mockRejectedValue(new Error('Connection refused'))
    };
    axios.create.mockReturnValue(mockInstance);

    const r = await test({ args: ['http://bad.example.com'] });
    expect(r.error).toBeDefined();
    expect(r.verdict).toContain('ERROR');
  });

  it('should return usage for empty args', async () => {
    const r = await test({ args: [] });
    expect(r).toContain('Usage');
  });
});
