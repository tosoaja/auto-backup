const dns = require('dns');
const { promisify } = require('util');
const resolvePtr = promisify(dns.resolvePtr);
const resolve4 = promisify(dns.resolve4);
module.exports = async function ptr({ args }) {
  const target = (args && args[0]) || '';
  if (!target) return 'Usage: ptr <ip or domain>';
  const result = { target, methods: {} };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    try { const ptr = await resolvePtr(target); result.methods.ptr = { hostnames: ptr }; }
    catch (err) { result.methods.ptr = { error: err.message }; }
  } else {
    try { const ips = await resolve4(target); result.resolvedIps = ips; }
    catch { result.methods.dns = { error: 'Could not resolve domain' }; }
  }
  return result;
};