const { exec, spawn } = require('child_process');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn()
}));

const check = require('../../../src/modules/nmap/commands/check');
const scan = require('../../../src/modules/nmap/commands/scan');

describe('nmap/check', () => {
  beforeEach(() => { exec.mockClear(); });

  it('should return installed=true when nmap found', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      if (cmd.includes('--version')) {
        cb(null, 'Nmap version 7.80 ( https://nmap.org )\n', '');
      } else {
        cb(null, '/usr/bin/nmap\n', '');
      }
    });
    const r = await check({});
    expect(r.installed).toBe(true);
    expect(r.version).toContain('7.80');
  });

  it('should return installed=false when nmap not found', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(new Error('not found'), '', '');
    });
    const r = await check({});
    expect(r.installed).toBe(false);
    expect(r.message).toContain('Nmap not installed');
  });
});

describe('nmap/scan', () => {
  beforeEach(() => {
    exec.mockClear();
    spawn.mockClear();
  });

  it('should scan a target and return output', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(null, '/usr/bin/nmap\n', '');
    });

    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn()
    };
    mockProc.stdout.on.mockImplementation((event, handler) => {
      if (event === 'data') setImmediate(() => handler('PORT  STATE SERVICE\n22/tcp open ssh\n'));
    });
    mockProc.stderr.on.mockImplementation(() => {});
    mockProc.on.mockImplementation((event, handler) => {
      if (event === 'close') setImmediate(() => handler(0));
    });
    spawn.mockReturnValue(mockProc);

    const r = await scan({ args: ['127.0.0.1', '22'] });
    expect(r).toContain('22/tcp');
  });

  it('should return usage for empty target', async () => {
    const r = await scan({ args: [] });
    expect(r).toContain('Usage');
  });

  it('should return message when nmap not installed', async () => {
    exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(new Error('not found'), '', '');
    });
    const r = await scan({ args: ['127.0.0.1'] });
    expect(r).toContain('Nmap not installed');
  });
});
