#!/usr/bin/env node

const http = require('http');
const { Server } = require('socket.io');
const AppLoader = require('./src/loader');
const { createHttpServer } = require('./src/server/http');
const { createSocketHandlers } = require('./src/server/socket');
const apiRoutes = require('./routes/api');

async function main() {
  const loader = new AppLoader();
  await loader.initialize();

  const config = loader.config;
  const logger = loader.logger;
  const eventBus = loader.eventBus;

  const app = createHttpServer(config);
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: config.server.maxHttpBufferSize || 1e8,
    pingTimeout: config.server.pingTimeout || 60000,
    cors: config.server.cors || { origin: '*' }
  });

  createSocketHandlers(io, config, { logger, eventBus });

  const PORT = process.env.PORT || config.server.port || 6969;
  const HOST = process.env.HOST || config.server.host || '0.0.0.0';

  server.listen(PORT, HOST, () => {
    console.clear();
    console.log(`
    +------------------------------------------+
    |  ${config.app.name} v${config.app.version}                        |
    |  listening on http://localhost:${PORT}     |
    +------------------------------------------+
    `);
    logger.info('Server started', { port: PORT, host: HOST });
    eventBus.emit('server.started', { port: PORT, host: HOST });

    try {
      const { exec } = require('child_process');
      exec(`xdg-open http://localhost:${PORT} 2>/dev/null || firefox http://localhost:${PORT} 2>/dev/null &`);
    } catch (e) { /* no browser available */ }
  });

  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    io.close();
    server.close(() => process.exit(0));
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: reason?.message || String(reason) });
  });
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
