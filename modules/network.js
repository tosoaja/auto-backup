const { exec } = require('child_process');
const os = require('os');
class NetworkModule {
    async execute(command, target) {
        if(!target||!target.trim()) target='localhost';
        target=target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g,'');
        const commands={
            ping:`ping -c 4 ${target}`,
            pingflood:os.platform()==='linux'?`timeout 10 ping -f ${target} 2>&1 || true`:`ping -c 100 ${target}`,
            traceroute:os.platform()==='linux'?`traceroute -m 30 ${target}`:`tracert ${target}`,
            nslookup:`nslookup ${target}`,
            netstat:os.platform()==='linux'?`netstat -tulanp 2>/dev/null | head -50`:`netstat -an`,
            whois:`whois ${target} 2>/dev/null || echo 'whois not installed'`,
            curl:`curl -I -s ${target} 2>/dev/null | head -20 || echo 'curl failed'`
        };
        const cmd=commands[command]||`echo "Unknown: ${command}"`;
        return new Promise((resolve)=>{exec(cmd,{timeout:30000},(error,stdout,stderr)=>{resolve({command:cmd,output:stdout||stderr||'No output',error:error?error.message:null,timestamp:new Date().toISOString()});});});
    }
}
module.exports = new NetworkModule();
