const axios = require('axios');
const https = require('https');
const http = require('http');
module.exports = async function test({ args }) {
  let targetUrl = (args && args[0]) || '';
  if (!targetUrl) return 'Usage: test <url>';
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) targetUrl = 'https://' + targetUrl;
  const result = { url: targetUrl, timestamp: new Date().toISOString(), vulnerable: false, details: [], headers: {}, recommendations: [], verdict: '', summary: '' };
  try {
    const instance = axios.create({
      timeout: 15000, maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      httpAgent: new http.Agent(),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const response = await instance.get(targetUrl, { validateStatus: () => true });
    result.headers = response.headers;
    result.statusCode = response.status;
    const xfo = response.headers['x-frame-options'];
    result.details.push({ check: 'X-Frame-Options', found: !!xfo, value: xfo || 'NOT SET', status: xfo ? 'PASS' : 'FAIL' });
    if (!xfo) { result.vulnerable = true; result.recommendations.push('Set X-Frame-Options: DENY or SAMEORIGIN'); }
    const csp = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
    result.details.push({ check: 'CSP frame-ancestors', found: !!csp, value: csp || 'NOT SET', status: csp ? 'INFO' : 'WARNING' });
    if (csp && !csp.includes('frame-ancestors')) result.recommendations.push('Add frame-ancestors to CSP');
    if (!csp) result.recommendations.push('Implement Content-Security-Policy');
    if (result.vulnerable) { result.verdict = 'VULNERABLE'; result.summary = 'Vulnerable to clickjacking!'; }
    else if (result.recommendations.length > 0) { result.verdict = 'PARTIALLY PROTECTED'; result.summary = 'Some protections in place.'; }
    else { result.verdict = 'PROTECTED'; result.summary = 'Well protected!'; }
  } catch (err) { result.error = err.message; result.verdict = 'ERROR'; result.summary = `Test failed: ${err.message}`; }
  return result;
};