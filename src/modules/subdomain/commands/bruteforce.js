const dns = require('dns');
const { promisify } = require('util');
const resolve4 = promisify(dns.resolve4);
const COMMON = ['www','mail','ftp','admin','blog','api','dev','test','stage','beta','app','web','portal','mail2','webmail','smtp','imap','vpn','secure','remote','support','help','forum','demo','shop','cdn','static','assets','docs','wiki','status','git','jenkins','jira','grafana','kibana','auth','login','sso','oauth','accounts','profile','billing','payment','checkout','cart','analytics','metrics','dashboard','reports','backup','db','database','redis','mysql','mongo','postgres','proxy','gateway','lb','balancer','ns1','ns2','mx1','mx2','mx3'];
module.exports = async function bruteforce({ args }) {
  const domain = (args && args[0]) || '';
  if (!domain) return 'Usage: bruteforce <domain>';
  const found = [];
  const chunks = [];
  for (let i = 0; i < COMMON.length; i += 20) chunks.push(COMMON.slice(i, i + 20));
  for (const chunk of chunks) {
    const results = await Promise.allSettled(chunk.map(async (sub) => {
      try { const addresses = await resolve4(`${sub}.${domain}`); return { subdomain: `${sub}.${domain}`, ips: addresses, resolved: true }; }
      catch { return { subdomain: `${sub}.${domain}`, resolved: false }; }
    }));
    results.forEach(r => { if (r.status === 'fulfilled' && r.value.resolved) found.push(r.value); });
  }
  found.sort((a, b) => a.subdomain.localeCompare(b.subdomain));
  return { source: 'dns-bruteforce', total: found.length, subdomains: found };
};