const fs = require('fs');
const path = require('path');
const terminalHandler = require('../../routes/terminal');

function createSocketHandlers(io, config, { logger, eventBus, registry, permissions, taskQueue }) {

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    logger.info('Client connected', { socketId: socket.id, ip: clientIp });
    eventBus.emit('client.connected', { socketId: socket.id, ip: clientIp });

    socket.emit('server-message', {
      type: 'info',
      message: `Connected to ${config.app.name} v${config.app.version}`,
      timestamp: new Date().toISOString()
    });

    socket.emit('client-info', { ip: clientIp, socketId: socket.id });

    // Plugin-based command dispatch
    socket.on('command', async (data) => {
      const { command, args, file, fileName } = data;
      if (!command) {
        socket.emit('command:result', { success: false, error: 'No command specified' });
        return;
      }

      const user = socket.user || { role: 'guest' };
      let filePath = null;
      if (file) {
        const ext = fileName ? path.extname(fileName) || '.bin' : '.bin';
        const tempDir = path.resolve(process.cwd(), 'temp_ctf');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        filePath = path.join(tempDir, `file_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        fs.writeFileSync(filePath, Buffer.from(file, 'base64'));
      }

      try {
        const cmdEntry = registry.find(command);
        if (!cmdEntry) {
          socket.emit('command:result', { success: false, command, error: `Command not found: ${command}` });
          return;
        }

        if (permissions && cmdEntry.permission) {
          await permissions.check(user, cmdEntry.permission);
        }

        const context = {
          args: args || [],
          filePath,
          fileName,
          socket,
          user,
          logger
        };

        const isLongRunning = cmdEntry.async && cmdEntry.timeout > 5000;
        if (isLongRunning && taskQueue) {
          const registeredType = `cmd:${command}`;

          if (!taskQueue._handlers.has(registeredType)) {
            taskQueue.registerHandler(registeredType, async (data, emitProgress, socketId) => {
              const result = await cmdEntry.handler(data.context);
              return result;
            });
          }

          const job = taskQueue.add({
            type: registeredType,
            data: { context },
            socketId: socket.id,
            priority: 0,
            timeout: cmdEntry.timeout
          });

          socket.emit('command:queued', { command, taskId: job.id, position: 0 });
          logger.command(socket.id, command, args, { queued: true, taskId: job.id });

          const onCompleted = ({ id, result, duration }) => {
            if (id === job.id) {
              socket.emit('command:result', { success: true, command, data: result, duration, taskId: id });
              logger.command(socket.id, command, args, { success: true, duration });
            }
          };

          const onFailed = ({ id, error }) => {
            if (id === job.id) {
              socket.emit('command:result', { success: false, command, error, taskId: id });
              logger.command(socket.id, command, args, { success: false, error });
            }
          };

          const onProgress = ({ id, progress }) => {
            if (id === job.id) {
              socket.emit('command:progress', { command, progress, taskId: id });
            }
          };

          taskQueue.on('task:completed', onCompleted);
          taskQueue.on('task:failed', onFailed);
          taskQueue.on('task:progress', onProgress);

          socket.once('command:cancel', () => {
            taskQueue.cancel(job.id);
            taskQueue.off('task:completed', onCompleted);
            taskQueue.off('task:failed', onFailed);
            taskQueue.off('task:progress', onProgress);
          });
        } else {
          const result = await registry.execute(command, context);
          socket.emit('command:result', result);
          logger.command(socket.id, command, args, result);
        }
      } catch (err) {
        if (err.code === 'PERMISSION_DENIED') {
          socket.emit('command:result', { success: false, command, error: 'Permission denied', permission: err.permission });
          logger.access(socket.id, command, err.permission, false);
        } else {
          socket.emit('command:result', { success: false, command, error: err.message });
          logger.error(`Command failed: ${command}`, { error: err.message, socketId: socket.id });
        }
      } finally {
        if (filePath && filePath.includes('temp_ctf')) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    });

    socket.on('command:list', () => {
      socket.emit('command:list', registry.listByCategory());
    });

    socket.on('execute-command', (data) => {
      terminalHandler.execute(socket, data);
      eventBus.emit('command.executed', { socketId: socket.id, command: data.command });
    });
    socket.on('cancel-command', () => terminalHandler.cancel(socket.id));



    // Bandwidth streaming (real-time traffic monitoring)
    socket.on('bandwidth-start', () => {
      const bwModule = require('../../modules/bandwidth');
      bwModule.startStream((data) => {
        socket.emit('bandwidth-data', data);
      });
    });

    socket.on('bandwidth-stop', () => {
      const bwModule = require('../../modules/bandwidth');
      bwModule.stopStream();
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
      eventBus.emit('client.disconnected', { socketId: socket.id });
      terminalHandler.cancel(socket.id);
      try {
        const bwModule = require('../../modules/bandwidth');
        bwModule.stopStream();
      } catch (e) { /* ignore */ }
    });
  });
}

module.exports = { createSocketHandlers };
