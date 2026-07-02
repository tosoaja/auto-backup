const fs = require('fs');
const os = require('os');

class BandwidthMonitor {
  constructor() {
    this.prev = null;
    this.interval = null;
    this.listeners = new Set();
  }

  _readNetDev() {
    try {
      const data = fs.readFileSync('/proc/net/dev', 'utf8');
      const lines = data.split('\n').slice(2);
      const ifaces = {};
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const name = parts[0].replace(':', '');
        if (name === 'lo') continue;
        ifaces[name] = {
          rxBytes: parseInt(parts[1], 10),
          txBytes: parseInt(parts[9], 10),
          rxPackets: parseInt(parts[2], 10),
          txPackets: parseInt(parts[10], 10)
        };
      }
      return ifaces;
    } catch {
      return null;
    }
  }

  getStaticInfo() {
    const ifaces = os.networkInterfaces();
    const result = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name === 'lo') continue;
      const info = { name, addresses: [] };
      if (addrs) {
        addrs.forEach(a => {
          info.addresses.push({ family: a.family, address: a.address, mac: a.mac, internal: a.internal });
        });
      }
      result.push(info);
    }
    return result;
  }

  startStream(callback) {
    this.listeners.add(callback);
    if (this.interval) return;
    this.prev = this._readNetDev();
    this.interval = setInterval(() => {
      const current = this._readNetDev();
      if (!current || !this.prev) {
        this.prev = current;
        return;
      }
      const delta = {};
      for (const iface of Object.keys(current)) {
        const p = this.prev[iface];
        const c = current[iface];
        if (!p) continue;
        delta[iface] = {
          rxSpeed: c.rxBytes - p.rxBytes,
          txSpeed: c.txBytes - p.txBytes,
          rxPackets: c.rxPackets - p.rxPackets,
          txPackets: c.txPackets - p.txPackets,
          rxBytes: c.rxBytes,
          txBytes: c.txBytes
        };
      }
      this.prev = current;
      const data = { interfaces: delta, timestamp: Date.now() };
      for (const cb of this.listeners) {
        try { cb(data); } catch {}
      }
    }, 1000);
  }

  stopStream(callback) {
    if (callback) {
      this.listeners.delete(callback);
    }
    if (!callback || this.listeners.size === 0) {
      this.listeners.clear();
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }
  }
}

module.exports = new BandwidthMonitor();
