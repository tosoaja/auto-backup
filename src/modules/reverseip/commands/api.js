const axios = require('axios');
module.exports = async function api({ args }) {
  const ip = (args && args[0]) || '';
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return 'Usage: api <ip address>';
  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    return { ip, ...data, timestamp: new Date().toISOString() };
  } catch (err) { return { error: err.message }; }
};