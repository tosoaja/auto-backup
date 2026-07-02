const { spawn } = require('child_process');
const os = require('os');
const activeProcesses = new Map();

class TerminalHandler {
    execute(socket, data) {
        const { command } = data;
        if (!command) { socket.emit('command-output',{type:'error',output:'[!] No command!'}); return; }
        this.cancel(socket.id);
        console.log(`[CMD] ${socket.id}: ${command}`);
        socket.emit('command-output',{type:'info',output:`$ ${command}\n`});
        const shell = os.platform()==='win32'?'powershell.exe':'/bin/bash';
        const shellArgs = os.platform()==='win32'?['-Command',command]:['-c',command];
        const proc = spawn(shell, shellArgs, {env:{...process.env,FORCE_COLOR:'true'},cwd:process.env.HOME||'/root'});
        activeProcesses.set(socket.id, proc);
        proc.stdout.on('data',(d)=>{socket.emit('command-output',{type:'stdout',output:d.toString()});});
        proc.stderr.on('data',(d)=>{socket.emit('command-output',{type:'stderr',output:d.toString()});});
        proc.on('close',(code)=>{activeProcesses.delete(socket.id);socket.emit('command-output',{type:code===0?'success':'error',output:`\n[Exit code: ${code}]`});socket.emit('command-complete',{exitCode:code});});
        proc.on('error',(err)=>{activeProcesses.delete(socket.id);socket.emit('command-output',{type:'error',output:`[!] ${err.message}`});socket.emit('command-complete',{exitCode:-1});});
    }
    cancel(socketId) {
        const proc = activeProcesses.get(socketId);
        if(proc){console.log(`[!] Killing process for ${socketId}`);proc.kill('SIGTERM');setTimeout(()=>{try{proc.kill('SIGKILL')}catch(e){}},2000);activeProcesses.delete(socketId);}
    }
}
module.exports = new TerminalHandler();
