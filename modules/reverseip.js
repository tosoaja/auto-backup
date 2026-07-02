const axios = require('axios');
const dns = require('dns');
const { promisify } = require('util');
const resolvePtr = promisify(dns.resolvePtr);

class ReverseIPLookup {
  async lookup(target) {
    if (!target || !target.trim()) {
      return { success: false, error: 'No target provided' };
    }
    const result = { target, timestamp: new Date().toISOString(), methods: {} };

    // Method 1: DNS PTR record
    try {
      const ptr = await resolvePtr(target);
      result.methods.ptr = { success: true, hostnames: ptr };
    } catch (err) {
      result.methods.ptr = { success: false, error: err.message };
    }

    // Method 2: Resolve IP from domain first, then try PTR
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
      try {
        const ips = await promisify(dns.resolve4)(target);
        result.resolvedIps = ips;
        if (ips.length > 0) {
          try {
            const ptr = await resolvePtr(ips[0]);
            result.methods.reverseFromIp = { success: true, ip: ips[0], hostnames: ptr };
          } catch {}
        }
      } catch {}
    }

    return result;
  }

  async lookupViaApi(ip) {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return { success: false, error: 'Invalid IP format' };
    }
    try {
      const { data } = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return {
        success: true,
        ip,
        ...data,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ReverseIPLookup();
