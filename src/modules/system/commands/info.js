const si = require('systeminformation');
const os = require('os');
module.exports = async function info() {
  const [cpu, mem, disk, network, osInfo] = await Promise.all([si.cpu(), si.mem(), si.fsSize(), si.networkInterfaces(), si.osInfo()]);
  const cpuLoad = await si.currentLoad();
  return {
    system: { manufacturer: cpu.manufacturer, brand: cpu.brand, cores: cpu.cores, threads: cpu.threads, speed: cpu.speed + ' GHz', load: cpuLoad.currentLoad.toFixed(2) + '%' },
    os: { platform: osInfo.platform, distro: osInfo.distro, release: osInfo.release, kernel: osInfo.kernel, arch: osInfo.arch, hostname: os.hostname(), uptime: Math.floor(os.uptime() / 3600) + ' hours' },
    memory: { total: (mem.total / 1e9).toFixed(2) + ' GB', used: (mem.used / 1e9).toFixed(2) + ' GB', free: (mem.free / 1e9).toFixed(2) + ' GB', usage: ((mem.used / mem.total) * 100).toFixed(2) + '%' },
    disk: disk.map(d => ({ fs: d.fs, size: (d.size / 1e9).toFixed(2) + ' GB', used: (d.used / 1e9).toFixed(2) + ' GB', mount: d.mount, usage: d.use + '%' })),
    network: network.map(n => ({ iface: n.iface, ip4: n.ip4, mac: n.mac, operstate: n.operstate })),
    loadavg: os.loadavg()
  };
};