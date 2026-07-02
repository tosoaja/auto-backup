const { spawn } = require('child_process');
class BrowserModule {
    constructor(){this.browsers={firefox:['firefox','firefox-esr'],chromium:['chromium-browser','chromium'],chrome:['google-chrome','google-chrome-stable'],brave:['brave-browser','brave']};}
    findBrowser(browserName='firefox'){const cmds=this.browsers[browserName]||this.browsers.firefox;for(const cmd of cmds){try{const r=require('child_process').execSync(`which ${cmd} 2>/dev/null`,{encoding:'utf8'});if(r.trim())return r.trim();}catch(e){continue;}}return 'xdg-open';}
    openUrl(url,browserName='firefox'){if(!url)return;const browserCmd=this.findBrowser(browserName);console.log(`[BROWSER] Opening ${url} with ${browserCmd}`);const proc=spawn(browserCmd,[url],{detached:true,stdio:'ignore'});proc.unref();return{success:true,browser:browserCmd,url};}
}
module.exports = new BrowserModule();
