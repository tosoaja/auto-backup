const { exec } = require('child_process');

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const ping = require('../../../src/modules/network/commands/ping');
const nslookup = require('../../../src/modules/network/commands/nslookup');
const traceroute = require('../../../src/modules/network/commands/traceroute');
const whois = require('../../../src/modules/network/commands/whois');
const netstat = require('../../../src/modules/network/commands/netstat');
const curl = require('../../../src/modules/network/commands/curl');

describe('network/ping', () => {
  beforeEach(() => {
    exec.mockClear();
  });

  it('should ping localhost by default', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'PING localhost ... 64 bytes from 127.0.0.1\n', '');
    });
    const r = await ping({ args: [] });
    expect(r).toContain('PING');
  });

  it('should ping specified target', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'PING google.com ... 64 bytes from 142.250.80.46\n', '');
    });
    const r = await ping({ args: ['google.com'] });
    expect(r).toContain('google.com');
  });
});

describe('network/nslookup', () => {
  beforeEach(() => { exec.mockClear(); });

  it('should lookup a domain', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'Name: example.com\nAddress: 93.184.216.34\n', '');
    });
    const r = await nslookup({ args: ['example.com'] });
    expect(r).toContain('example.com');
  });

  it('should default to localhost for empty args', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'Name: localhost\nAddress: 127.0.0.1\n', '');
    });
    const r = await nslookup({ args: [] });
    expect(r).toContain('localhost');
  });
});

describe('network/traceroute', () => {
  beforeEach(() => { exec.mockClear(); });

  it('should traceroute a target', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'traceroute to 8.8.8.8\n 1  192.168.1.1\n', '');
    });
    const r = await traceroute({ args: ['8.8.8.8'] });
    expect(r).toContain('traceroute');
  });

  it('should default to localhost for empty args', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'traceroute to localhost\n 1  127.0.0.1\n', '');
    });
    const r = await traceroute({ args: [] });
    expect(r).toContain('localhost');
  });
});

describe('network/whois', () => {
  beforeEach(() => { exec.mockClear(); });

  it('should whois a domain', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'Domain Name: EXAMPLE.COM\nRegistrar: IANA\n', '');
    });
    const r = await whois({ args: ['example.com'] });
    expect(r).toContain('EXAMPLE.COM');
  });

  it('should return usage for empty args', async () => {
    const r = await whois({ args: [] });
    expect(r).toContain('Usage');
  });
});

describe('network/netstat', () => {
  beforeEach(() => { exec.mockClear(); });

  it('should return netstat output', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, 'Active Internet connections\nProto Recv-Q Send-Q\n', '');
    });
    const r = await netstat({});
    expect(r).toContain('Active');
  });
});

describe('network/curl', () => {
  beforeEach(() => { exec.mockClear(); });

  it('should fetch a URL', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, '<html><body>Hello</body></html>', '');
    });
    const r = await curl({ args: ['http://example.com'] });
    expect(r).toContain('Hello');
  });

  it('should return usage for empty args', async () => {
    const r = await curl({ args: [] });
    expect(r).toContain('Usage');
  });
});
