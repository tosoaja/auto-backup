const dns = require('dns');
const { promisify } = require('util');

const resolveA = promisify(dns.resolve4);
const resolveAAAA = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveNs = promisify(dns.resolveNs);
const resolveCname = promisify(dns.resolveCname);
const resolveSoa = promisify(dns.resolveSoa);
const resolveSrv = promisify(dns.resolveSrv);
const resolvePtr = promisify(dns.resolvePtr);
const resolveNaptr = promisify(dns.resolveNaptr);
const resolveCaa = promisify(dns.resolveCaa);

class DnsLookup {
  async lookup(domain, recordTypes) {
    if (!domain || !domain.trim()) {
      return { success: false, error: 'No domain provided' };
    }
    const types = recordTypes || ['A', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'AAAA', 'SRV', 'CAA'];
    const results = {};
    const resolvers = {
      'A': resolveA, 'AAAA': resolveAAAA, 'MX': resolveMx, 'TXT': resolveTxt,
      'NS': resolveNs, 'CNAME': resolveCname, 'SOA': resolveSoa,
      'SRV': resolveSrv, 'PTR': resolvePtr, 'NAPTR': resolveNaptr, 'CAA': resolveCaa
    };

    for (const type of types) {
      const resolver = resolvers[type];
      if (!resolver) continue;
      try {
        const data = await resolver(domain);
        results[type] = { status: 'found', data };
      } catch (err) {
        if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
          results[type] = { status: 'not found', data: null };
        } else {
          results[type] = { status: 'error', error: err.message };
        }
      }
    }

    return { success: true, domain, records: results, timestamp: new Date().toISOString() };
  }
}

module.exports = new DnsLookup();
