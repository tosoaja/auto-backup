const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this._history = [];
    this._maxHistory = 1000;
  }

  emit(event, data) {
    this._history.push({
      event,
      data,
      timestamp: new Date().toISOString()
    });

    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    return super.emit(event, data);
  }

  on(event, handler) {
    super.on(event, handler);
    return () => super.off(event, handler);
  }

  once(event, handler) {
    super.once(event, handler);
  }

  getHistory(event) {
    if (event) {
      return this._history.filter(h => h.event === event);
    }
    return this._history;
  }

  clearHistory() {
    this._history = [];
  }

  waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.once(event, handler);
    });
  }
}

module.exports = EventBus;
