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
const resolveCaa = promisify(dns.resolveCaa);
module.exports = async function lookup({ args }) {
  const domain = (args && args[0]) || '';
  if (!domain) return 'Usage: lookup <domain> [type1,type2,...]';
  let types = ['A', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'AAAA'];
  if (args && args.length > 1 && args[1].includes(',')) {
    types = args[1].split(',').map(t => t.trim().toUpperCase());
  }
  const resolvers = { 'A': resolveA, 'AAAA': resolveAAAA, 'MX': resolveMx, 'TXT': resolveTxt, 'NS': resolveNs, 'CNAME': resolveCname, 'SOA': resolveSoa, 'SRV': resolveSrv, 'CAA': resolveCaa };
  const results = {};
  for (const type of types) {
    const resolver = resolvers[type];
    if (!resolver) continue;
    try { const data = await resolver(domain); results[type] = { status: 'found', data }; }
    catch (err) { results[type] = { status: 'not found', error: err.code }; }
  }
  return { domain, records: results, timestamp: new Date().toISOString() };
};