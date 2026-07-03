const dns = require('dns');

jest.mock('dns', () => {
  const actual = jest.requireActual('dns');
  const mock = { ...actual };

  const mockResolve4 = jest.fn((domain, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    cb(null, ['93.184.216.34']);
  });

  const mockResolve6 = jest.fn((domain, cb) => {
    cb({ code: 'ENOTFOUND' }, null);
  });

  const mockResolveMx = jest.fn((domain, cb) => {
    cb(null, [{ exchange: 'mail.example.com', priority: 10 }]);
  });

  const mockResolveTxt = jest.fn((domain, cb) => {
    cb(null, [['v=spf1 include:_spf.example.com ~all']]);
  });

  const mockResolveNs = jest.fn((domain, cb) => {
    cb(null, ['ns1.example.com', 'ns2.example.com']);
  });

  const mockResolveCname = jest.fn((domain, cb) => {
    cb({ code: 'ENODATA' }, null);
  });

  const mockResolveSoa = jest.fn((domain, cb) => {
    cb({ code: 'ENOTFOUND' }, null);
  });

  const mockResolveSrv = jest.fn((domain, cb) => {
    cb({ code: 'ENOTFOUND' }, null);
  });

  const mockResolveCaa = jest.fn((domain, cb) => {
    cb({ code: 'ENOTFOUND' }, null);
  });

  mock.resolve4 = mockResolve4;
  mock.resolve6 = mockResolve6;
  mock.resolveMx = mockResolveMx;
  mock.resolveTxt = mockResolveTxt;
  mock.resolveNs = mockResolveNs;
  mock.resolveCname = mockResolveCname;
  mock.resolveSoa = mockResolveSoa;
  mock.resolveSrv = mockResolveSrv;
  mock.resolveCaa = mockResolveCaa;

  return mock;
});

const lookup = require('../../../src/modules/dns/commands/lookup');

describe('dns/lookup', () => {
  it('should return records for known domain', async () => {
    const r = await lookup({ args: ['example.com'] });
    expect(r.domain).toBe('example.com');
    expect(r.records.A.status).toBe('found');
    expect(r.records.A.data).toContain('93.184.216.34');
    expect(r.records.MX.status).toBe('found');
    expect(r.records.TXT.status).toBe('found');
    expect(r.records.NS.status).toBe('found');
  });

  it('should filter by specified types', async () => {
    const r = await lookup({ args: ['example.com', 'A,MX'] });
    expect(r.records.A).toBeDefined();
    expect(r.records.MX).toBeDefined();
    expect(r.records.TXT).toBeUndefined();
  });

  it('should include timestamp', async () => {
    const r = await lookup({ args: ['example.com'] });
    expect(r.timestamp).toBeDefined();
    expect(() => new Date(r.timestamp)).not.toThrow();
  });

  it('should return usage for empty domain', async () => {
    const r = await lookup({ args: [] });
    expect(r).toContain('Usage');
  });
});
