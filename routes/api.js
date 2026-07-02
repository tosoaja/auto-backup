const express = require('express');
const router = express.Router();
const os = require('os');
const { execSync } = require('child_process');

router.get('/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        platform: os.platform(),
        hostname: os.hostname(),
        memory: { total: (os.totalmem()/1e9).toFixed(2)+' GB', free: (os.freemem()/1e9).toFixed(2)+' GB' }
    });
});

router.get('/sysinfo', (req, res) => {
    try {
        res.json({
            hostname: os.hostname(), platform: os.platform(), release: os.release(),
            arch: os.arch(), cpus: os.cpus().length,
            memory: (os.totalmem()/1e9).toFixed(2)+' GB',
            uptime: Math.floor(os.uptime()/3600)+' hours', loadavg: os.loadavg()
        });
    } catch(err) { res.status(500).json({error:err.message}); }
});

router.post('/exec', (req,res) => {
    const {command} = req.body;
    if(!command) return res.status(400).json({error:'No command'});
    const allowed = ['whoami','hostname','date','uptime','free -h','df -h','uname -a'];
    if(!allowed.some(c=>command.startsWith(c))) return res.status(403).json({error:'Use terminal'});
    try { res.json({output:execSync(command,{timeout:10000}).toString()}); }
    catch(err) { res.status(500).json({error:err.message}); }
});

module.exports = router;
