jest.mock('systeminformation', () => ({
  cpu: jest.fn().mockResolvedValue({ manufacturer: 'Intel', brand: 'Core i7', cores: 4, threads: 8, speed: 2.5 }),
  mem: jest.fn().mockResolvedValue({ total: 16e9, used: 8e9, free: 8e9 }),
  fsSize: jest.fn().mockResolvedValue([{ fs: '/dev/sda1', size: 500e9, used: 200e9, mount: '/', use: 40 }]),
  networkInterfaces: jest.fn().mockResolvedValue([{ iface: 'eth0', ip4: '192.168.1.1', mac: '00:11:22:33:44:55', operstate: 'up' }]),
  osInfo: jest.fn().mockResolvedValue({ platform: 'linux', distro: 'Ubuntu', release: '22.04', kernel: '5.15', arch: 'x64' }),
  currentLoad: jest.fn().mockResolvedValue({ currentLoad: 25.5 })
}));

const info = require('../../../src/modules/system/commands/info');

describe('system/info', () => {
  it('should return system information object', async () => {
    const r = await info({});
    expect(r).toHaveProperty('system');
    expect(r).toHaveProperty('os');
    expect(r).toHaveProperty('memory');
    expect(r).toHaveProperty('disk');
    expect(r).toHaveProperty('network');
    expect(r).toHaveProperty('loadavg');
  });

  it('should include CPU brand and cores', async () => {
    const r = await info({});
    expect(r.system.brand).toBe('Core i7');
    expect(r.system.cores).toBe(4);
    expect(r.system.threads).toBe(8);
  });

  it('should include memory info', async () => {
    const r = await info({});
    expect(r.memory.total).toContain('GB');
    expect(r.memory.usage).toContain('%');
  });

  it('should include disk info', async () => {
    const r = await info({});
    expect(r.disk.length).toBeGreaterThanOrEqual(1);
    expect(r.disk[0].mount).toBe('/');
  });

  it('should include network interfaces', async () => {
    const r = await info({});
    expect(r.network.length).toBeGreaterThanOrEqual(1);
    expect(r.network[0].iface).toBe('eth0');
  });
});
