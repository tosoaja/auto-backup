const axios = require('axios');
const dns = require('dns');
const { promisify } = require('util');
const resolve4 = promisify(dns.resolve4);

const COMMON_SUBDOMAINS = [
  'www','mail','ftp','admin','blog','api','dev','test','stage','beta',
  'app','web','portal','mail2','webmail','pop','pop3','smtp','imap',
  'vpn','secure','remote','support','help','forum','demo','shop','store',
  'cdn','static','assets','img','images','media','video','download',
  'docs','wiki','status','monitor','tracker','git','svn','jenkins',
  'jira','confluence','grafana','prometheus','kibana','elastic',
  'k8s','kubernetes','docker','registry','npm','pypi','maven',
  'auth','login','sso','oauth','identity','accounts','profile',
  'billing','invoice','payment','checkout','cart','order',
  'calendar','chat','meet','zoom','teams','slack','discord',
  'analytics','metrics','dashboard','reports','backup','db','database',
  'redis','mysql','mongo','postgres','elasticsearch','rabbitmq',
  'jenkins','gitlab','bitbucket','sonar','nexus','artifactory',
  'proxy','gateway','api-gateway','lb','loadbalancer','balancer',
  'ns1','ns2','ns3','ns4','dns1','dns2','mx1','mx2','mx3','mx4'
];

class SubdomainFinder {
  constructor() {
    this.timeout = 10000;
  }

  async findWithCrtSh(domain) {
    try {
      const { data } = await axios.get(
        `https://crt.sh/?q=%25.${domain}&output=json`,
        { timeout: this.timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const subdomains = new Set();
      if (Array.isArray(data)) {
        data.forEach(entry => {
          const name = entry.name_value;
          if (name) {
            name.split('\n').forEach(n => {
              const s = n.trim().toLowerCase();
              if (s.endsWith('.' + domain) || s === domain) {
                subdomains.add(s);
              }
            });
          }
        });
      }
      return { success: true, source: 'crt.sh', total: subdomains.size, subdomains: [...subdomains].sort() };
    } catch (err) {
      return { success: false, source: 'crt.sh', error: err.message, subdomains: [] };
    }
  }

  async findWithDnsBruteforce(domain, wordlist) {
    const list = wordlist || COMMON_SUBDOMAINS;
    const found = [];
    const chunks = this.chunkArray(list, 20);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (sub) => {
          const hostname = `${sub}.${domain}`;
          try {
            const addresses = await resolve4(hostname);
            return { subdomain: hostname, ips: addresses, resolved: true };
          } catch {
            return { subdomain: hostname, resolved: false };
          }
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.resolved) {
          found.push(r.value);
        }
      });
    }
    found.sort((a, b) => a.subdomain.localeCompare(b.subdomain));
    return { success: true, source: 'dns-bruteforce', total: found.length, subdomains: found };
  }

  chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
}

module.exports = new SubdomainFinder();
