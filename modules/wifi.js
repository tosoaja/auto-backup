const { exec } = require('child_process');
class WiFiModule {
    async getWifiProfiles(){return new Promise((resolve)=>{exec('nmcli -t -f NAME,TYPE connection show 2>/dev/null',(error,stdout)=>{if(error){resolve({error:'nmcli not available.',profiles:[],raw:error.message});return;}const lines=stdout.split('\n').filter(l=>l.trim());const wifiProfiles=lines.filter(l=>{const p=l.split(':');return p.length>=2&&(p[1].includes('wireless')||p[1].includes('wifi')||p[1].includes('802-11'));}).map(l=>{const p=l.split(':');return{name:p[0],type:p[1]||'unknown'};});resolve({success:true,total:wifiProfiles.length,profiles:wifiProfiles,raw:stdout});});});}
}
module.exports = new WiFiModule();
