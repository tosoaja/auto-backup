const path = require('path');
const fs = require('fs');
const Logger = require('../../../src/core/logger');

describe('Logger', () => {
  const testLogDir = path.resolve(process.cwd(), 'logs-test');
  let logger;

  beforeEach(() => {
    logger = new Logger({
      directory: testLogDir,
      console: false,
      level: 'debug'
    });
  });

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  it('should create log directory', () => {
    expect(fs.existsSync(testLogDir)).toBe(true);
  });

  it('should log info messages', () => {
    expect(() => logger.info('test info', { key: 'value' })).not.toThrow();
  });

  it('should log error messages', () => {
    expect(() => logger.error('test error', { err: 'something' })).not.toThrow();
  });

  it('should log audit messages', () => {
    expect(() => logger.audit('test.action', { user: 'test' })).not.toThrow();
  });

  it('should log command audit', () => {
    expect(() => logger.command('user1', 'test.cmd', ['arg1'], { success: true })).not.toThrow();
  });

  it('should log access checks', () => {
    expect(() => logger.access('user1', 'read', 'forensic.data', true)).not.toThrow();
  });

  it('should write to error log file', () => {
    logger.error('write test error');
    // Wait for async write
    return new Promise((resolve) => {
      setTimeout(() => {
        const errorLog = path.join(testLogDir, 'error.log');
        expect(fs.existsSync(errorLog)).toBe(true);
        const content = fs.readFileSync(errorLog, 'utf-8');
        expect(content).toContain('write test error');
        resolve();
      }, 500);
    });
  });
});
