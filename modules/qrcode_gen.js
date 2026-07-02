const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
class QRCodeGenerator {
    constructor(){this.outputDir=path.join(__dirname,'..','public','qrcodes');if(!fs.existsSync(this.outputDir))fs.mkdirSync(this.outputDir,{recursive:true});}
    async generateQR(text,options={}){const def={type:'png',errorCorrectionLevel:'H',margin:2,width:options.size||300,color:{dark:options.fgColor||'#00FF00',light:options.bgColor||'#0A0A0A'}};try{const dataUrl=await QRCode.toDataURL(text,def);return{success:true,dataUrl,text,timestamp:new Date().toISOString()};}catch(err){return{success:false,error:err.message};}}
    async generateAndSave(text,filename,options={}){try{const fp=path.join(this.outputDir,filename||`qr_${Date.now()}.png`);const qo={type:'png',errorCorrectionLevel:'H',margin:2,width:options.size||500,color:{dark:options.fgColor||'#00FF00',light:options.bgColor||'#0A0A0A'}};await QRCode.toFile(fp,text,qo);return{success:true,filePath:`/qrcodes/${path.basename(fp)}`,text,timestamp:new Date().toISOString()};}catch(err){return{success:false,error:err.message};}}
    async generateStyledQR(text,style='matrix'){const styles={matrix:{fgColor:'#00FF00',bgColor:'#0A0A0A'},neon:{fgColor:'#FF00FF',bgColor:'#000000'},cyan:{fgColor:'#00FFFF',bgColor:'#0A0A0A'},red:{fgColor:'#FF4444',bgColor:'#0A0A0A'},white:{fgColor:'#FFFFFF',bgColor:'#000000'},hacker:{fgColor:'#00FF00',bgColor:'#000000'}};const c=styles[style]||styles.matrix;return await this.generateQR(text,{fgColor:c.fgColor,bgColor:c.bgColor,size:350});}
    async batchGenerate(items){const results=[];for(const item of items){const r=await this.generateQR(item.text,item.options||{});results.push({label:item.label||'Untitled',...r});}return{success:true,count:results.length,items:results,timestamp:new Date().toISOString()};}
}
module.exports = new QRCodeGenerator();
