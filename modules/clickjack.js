const axios = require('axios');
const https = require('https');
const http = require('http');
class ClickjackTester {
    async test(targetUrl){
        if(!targetUrl.startsWith('http://')&&!targetUrl.startsWith('https://'))targetUrl='https://'+targetUrl;
        const result={url:targetUrl,timestamp:new Date().toISOString(),vulnerable:false,details:[],headers:{},csp:null,recommendations:[],verdict:'',verdictColor:'',verdictIcon:'',summary:''};
        try{
            const instance=axios.create({timeout:15000,maxRedirects:5,httpsAgent:new https.Agent({rejectUnauthorized:false}),httpAgent:new http.Agent(),headers:{'User-Agent':'Mozilla/5.0 KILLER_VOIDS_Clickjack_Tester/3.0'}});
            const response=await instance.get(targetUrl,{validateStatus:(s)=>true});
            result.headers=response.headers;result.statusCode=response.status;result.server=response.headers['server']||'Unknown';
            const xfo=response.headers['x-frame-options'];
            result.details.push({check:'X-Frame-Options Header',found:!!xfo,value:xfo||'NOT SET',status:xfo?'PASS':'FAIL'});
            if(!xfo){result.vulnerable=true;result.recommendations.push('Set X-Frame-Options header to DENY or SAMEORIGIN');}
            else{const x=xfo.toUpperCase();if(x==='DENY')result.details[result.details.length-1].description='✓ Protected - DENY';else if(x==='SAMEORIGIN'){result.details[result.details.length-1].description='⚠ Partial - SAMEORIGIN';result.recommendations.push('Consider using DENY');}}
            const csp=response.headers['content-security-policy']||response.headers['content-security-policy-report-only'];
            result.details.push({check:'CSP frame-ancestors',found:!!csp,value:csp||'NOT SET',status:csp?'INFO':'WARNING'});
            if(csp){result.csp=csp;const fa=this.parseCSP(csp);if(fa){result.details[result.details.length-1].description=`✓ frame-ancestors: ${fa}`;if(fa==="'none'")result.details[result.details.length-1].status='PASS';}else{result.details[result.details.length-1].description='⚠ No frame-ancestors directive';if(!xfo)result.vulnerable=true;result.recommendations.push('Add frame-ancestors to CSP');}}
            else{result.recommendations.push('Implement Content-Security-Policy');}
            const htmlBody=response.data?.toString()||'';
            const hasFB=/if\s*\(\s*top\s*!==?\s*self\s*\)/i.test(htmlBody)||/top\.location\s*=\s*self\.location/i.test(htmlBody);
            result.details.push({check:'JS Frame Busting',found:hasFB,value:hasFB?'Detected':'Not found',status:hasFB?'INFO':'WARNING'});
            if(result.vulnerable){result.verdict='VULNERABLE';result.verdictColor='#ff4444';result.verdictIcon='🔴';result.summary='VULNERABLE to clickjacking!';}
            else if(result.recommendations.length>0){result.verdict='PARTIALLY PROTECTED';result.verdictColor='#ffff00';result.verdictIcon='🟡';result.summary='Some protections in place.';}
            else{result.verdict='PROTECTED';result.verdictColor='#00ff00';result.verdictIcon='🟢';result.summary='Well protected!';}
        }catch(err){result.error=err.message;result.verdict='ERROR';result.verdictColor='#ff4444';result.summary=`Test failed: ${err.message}`;}
        return result;
    }
    parseCSP(csp){const d=csp.split(';');for(const x of d){const t=x.trim();if(t.startsWith('frame-ancestors'))return t.substring('frame-ancestors'.length).trim();}return null;}
    generateTestHTML(targetUrl){return `<!DOCTYPE html><html><head><title>Clickjack Test</title><style>body{margin:0;padding:20px;background:#0a0a0a;color:#00ff00;font-family:monospace}iframe{width:100%;height:600px;border:2px solid #ff4444}</style></head><body><h1>Test: ${targetUrl}</h1><p>If visible = VULNERABLE!</p><iframe src="${targetUrl}" sandbox="allow-scripts allow-same-origin"></iframe></body></html>`;}
    async batchTest(urls){const results=[];for(const url of urls){results.push(await this.test(url));await new Promise(r=>setTimeout(r,1000));}return results;}
}
module.exports = new ClickjackTester();
