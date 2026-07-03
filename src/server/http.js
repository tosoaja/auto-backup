const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

function createHttpServer(config) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(config.server.cors || { origin: '*' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs || 15 * 60 * 1000,
    max: config.rateLimit.max || 5000,
    message: { error: 'Too many requests' }
  });
  app.use('/api', limiter);

  app.use(express.static(path.resolve(process.cwd(), 'public')));

  return app;
}

module.exports = { createHttpServer };
