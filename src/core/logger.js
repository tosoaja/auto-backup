const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor(config = {}) {
    this.logDir = config.directory || path.resolve(process.cwd(), 'logs');

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const logLevel = config.level || 'info';
    const maxSize = config.maxSize || 10 * 1024 * 1024;
    const maxFiles = config.maxFiles || 10;

    const transports = [
      new winston.transports.File({
        filename: path.join(this.logDir, 'error.log'),
        level: 'error',
        maxsize: maxSize,
        maxFiles: maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }),
      new winston.transports.File({
        filename: path.join(this.logDir, 'combined.log'),
        maxsize: maxSize,
        maxFiles: maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),
      new winston.transports.File({
        filename: path.join(this.logDir, 'audit.log'),
        maxsize: maxSize,
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ];

    if (config.console !== false) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${level}: ${message}${metaStr}`;
          })
        )
      }));
    }

    this.logger = winston.createLogger({
      level: logLevel,
      levels: {
        ...winston.config.npm.levels,
        audit: 0
      },
      transports
    });
  }

  info(message, meta) {
    this.logger.info(message, meta);
  }

  warn(message, meta) {
    this.logger.warn(message, meta);
  }

  error(message, meta) {
    this.logger.error(message, meta);
  }

  debug(message, meta) {
    this.logger.debug(message, meta);
  }

  audit(action, meta) {
    this.logger.log('audit', action, {
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  command(user, command, args, result) {
    this.audit('command.executed', {
      user: user || 'anonymous',
      command,
      args,
      success: result ? !result.error : true,
      duration: result ? result.duration : null
    });
  }

  access(user, action, resource, allowed) {
    this.audit('access.check', {
      user: user || 'anonymous',
      action,
      resource,
      allowed
    });
  }
}

module.exports = Logger;
