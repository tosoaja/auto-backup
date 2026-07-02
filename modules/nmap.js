const { spawn, exec } = require('child_process');
class NmapModule {
    constructor(){this.nmapPath='';this.initialized=false;}
    async checkInstalled(){return new Promise((resolve)=>{exec('which nmap 2>/dev/null',(error,stdout)=>{if(error||!stdout.trim()){resolve({installed:false,path:null,message:'Nmap not installed. Run: sudo apt install nmap -y'});}else{this.nmapPath=stdout.trim();this.initialized=true;resolve({installed:true,path:this.nmapPath,version:''});}});});}
    async getVersion(){return new Promise((resolve)=>{exec(`${this.nmapPath} --version 2>/dev/null | head -1`,(error,stdout)=>{resolve(stdout.trim()||'Unknown version');});});}
    scanPorts(target,ports,onOutput,onComplete,onError){
        target=target.replace(/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g,'');
        const args=['-T4','-v'];
        if(ports==='common'){args.push('--top-ports','100');}else if(ports==='all'){args.push('-p-');}else if(ports==='vuln'){args.push('--script','vuln');args.push('-p','1-10000');}else{args.push('-p',ports);}
        if(ports!=='vuln')args.push('-sV');args.push(target);
        console.log(`[NMAP] ${target} args:`,args.join(' '));
        const proc=spawn(this.nmapPath,args,{stdio:['pipe','pipe','pipe']});
        proc.stdout.on('data',(data)=>{data.toString().split('\n').filter(l=>l.trim()).forEach(line=>{onOutput({type:'stdout',output:line,timestamp:new Date().toISOString()});});});
        proc.stderr.on('data',(data)=>{onOutput({type:'stderr',output:data.toString(),timestamp:new Date().toISOString()});});
        proc.on('close',(code)=>{onComplete({exitCode:code,target,ports,timestamp:new Date().toISOString()});});
        proc.on('error',(err)=>{onError({message:err.message,target});});
        return proc;
    }
}
module.exports = new NmapModule();
