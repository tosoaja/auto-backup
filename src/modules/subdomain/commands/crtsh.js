const axios = require('axios');
module.exports = async function crtsh({ args }) {
  const domain = (args && args[0]) || '';
  if (!domain) return 'Usage: crtsh <domain>';
  try {
    const { data } = await axios.get(`https://crt.sh/?q=%25.${domain}&output=json`, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const subdomains = new Set();
    if (Array.isArray(data)) {
      data.forEach(entry => {
        const name = entry.name_value;
        if (name) name.split('\n').forEach(n => { const s = n.trim().toLowerCase(); if (s.endsWith('.' + domain) || s === domain) subdomains.add(s); });
      });
    }
    return { source: 'crt.sh', total: subdomains.size, subdomains: [...subdomains].sort() };
  } catch (err) { return { source: 'crt.sh', error: err.message, subdomains: [] }; }
};