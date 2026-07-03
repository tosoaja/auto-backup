const os = require('os');
module.exports = function interfaces() {
  const ifaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (name === 'lo') continue;
    const info = { name, addresses: [] };
    if (addrs) addrs.forEach(a => { info.addresses.push({ family: a.family, address: a.address, mac: a.mac }); });
    result.push(info);
  }
  return { interfaces: result };
};