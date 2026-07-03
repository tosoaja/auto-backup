const EventEmitter = require('events');

class TaskTimeoutError extends Error {
  constructor(id, timeout) {
    super(`Task timed out after ${timeout}ms: ${id}`);
    this.name = 'TaskTimeoutError';
    this.code = 'TASK_TIMEOUT';
  }
}

class TaskCancelledError extends Error {
  constructor(id) {
    super(`Task cancelled: ${id}`);
    this.name = 'TaskCancelledError';
    this.code = 'TASK_CANCELLED';
  }
}

class TaskQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 3;
    this.defaultTimeout = options.defaultTimeout || 300000;
    this._queue = [];
    this._active = new Map();
    this._completed = [];
    this._maxCompleted = options.maxCompleted || 200;
    this._handlers = new Map();
    this._idCounter = 0;
    this._processing = false;
  }

  registerHandler(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for ${type} must be a function`);
    }
    this._handlers.set(type, handler);
  }

  add(taskDef) {
    const job = {
      id: `${Date.now()}-${++this._idCounter}`,
      type: taskDef.type,
      data: taskDef.data || {},
      priority: taskDef.priority || 0,
      socketId: taskDef.socketId || null,
      timeout: taskDef.timeout || this.defaultTimeout,
      createdAt: Date.now(),
      status: 'queued',
      progress: 0,
      result: null,
      error: null
    };

    const insertIdx = this._queue.findIndex(t => t.priority < job.priority);
    if (insertIdx === -1) {
      this._queue.push(job);
    } else {
      this._queue.splice(insertIdx, 0, job);
    }

    this.emit('task:queued', { id: job.id, type: job.type, position: this._queue.length });
    this._processNext();
    return job;
  }

  async _processNext() {
    if (this._processing) return;
    this._processing = true;

    while (this._active.size < this.concurrency && this._queue.length > 0) {
      const job = this._queue.shift();
      this._execute(job);
    }

    this._processing = false;
  }

  async _execute(job) {
    const cleanup = () => {
      this._active.delete(job.id);
      this._archive(job);
      this._processNext();
    };

    job.status = 'running';
    job.startedAt = Date.now();
    this._active.set(job.id, job);
    this.emit('task:started', { id: job.id, type: job.type });

    const handler = this._handlers.get(job.type);
    if (!handler) {
      this._fail(job, new Error(`No handler registered for task type: ${job.type}`));
      cleanup();
      return;
    }

    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new TaskTimeoutError(job.id, job.timeout));
      }, job.timeout);
    });

    try {
      const emitProgress = (progress) => {
        job.progress = progress;
        this.emit('task:progress', { id: job.id, type: job.type, progress });
      };

      const result = await Promise.race([
        handler(job.data, emitProgress, job.socketId),
        timeoutPromise
      ]);

      clearTimeout(timeoutHandle);
      job.status = 'completed';
      job.result = result;
      job.completedAt = Date.now();

      cleanup();
      this.emit('task:completed', {
        id: job.id, type: job.type, result,
        duration: job.completedAt - job.startedAt
      });
      return;
    } catch (err) {
      clearTimeout(timeoutHandle);
      if (err instanceof TaskTimeoutError) {
        this._fail(job, err);
      } else if (err instanceof TaskCancelledError) {
        this._cancel(job);
      } else {
        this._fail(job, err);
      }
    }

    cleanup();
  }

  _fail(job, error) {
    job.status = 'failed';
    job.error = error.message;
    job.failedAt = Date.now();
    this.emit('task:failed', { id: job.id, type: job.type, error: error.message });
  }

  _cancel(job) {
    job.status = 'cancelled';
    job.completedAt = Date.now();
    this.emit('task:cancelled', { id: job.id, type: job.type });
  }

  _archive(job) {
    this._completed.unshift(job);
    if (this._completed.length > this._maxCompleted) {
      this._completed.pop();
    }
  }

  cancel(id) {
    const active = this._active.get(id);
    if (active) {
      active.status = 'cancelled';
      this.emit('task:cancelled', { id, type: active.type });
      this._active.delete(id);
      this._archive(active);
      this._processNext();
      return true;
    }

    const idx = this._queue.findIndex(j => j.id === id);
    if (idx !== -1) {
      const job = this._queue.splice(idx, 1)[0];
      job.status = 'cancelled';
      this.emit('task:cancelled', { id, type: job.type });
      return true;
    }

    return false;
  }

  cancelBySocket(socketId) {
    let count = 0;
    for (const [id, job] of this._active) {
      if (job.socketId === socketId) {
        this.cancel(id);
        count++;
      }
    }
    this._queue = this._queue.filter(j => {
      if (j.socketId === socketId) {
        j.status = 'cancelled';
        count++;
        return false;
      }
      return true;
    });
    return count;
  }

  getStatus(id) {
    if (this._active.has(id)) return this._active.get(id);
    const queued = this._queue.find(j => j.id === id);
    if (queued) return queued;
    return this._completed.find(j => j.id === id) || null;
  }

  stats() {
    return {
      active: this._active.size,
      queued: this._queue.length,
      completed: this._completed.length,
      concurrency: this.concurrency
    };
  }

  clearCompleted() {
    this._completed = [];
  }
}

module.exports = { TaskQueue, TaskTimeoutError, TaskCancelledError };
