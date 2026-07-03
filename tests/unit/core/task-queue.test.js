const { TaskQueue, TaskTimeoutError } = require('../../../src/core/task-queue');

describe('TaskQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new TaskQueue({ concurrency: 2, defaultTimeout: 5000 });
  });

  afterEach(() => {
    queue.removeAllListeners();
  });

  describe('add', () => {
    it('should add a task to the queue', () => {
      queue.registerHandler('test', async (d) => d);
      const task = queue.add({ type: 'test', data: { x: 1 } });
      expect(task.id).toBeDefined();
      expect(task.type).toBe('test');
    });

    it('should execute task immediately if handler exists', (done) => {
      queue.registerHandler('immediate', async (data) => data.value * 2);

      queue.on('task:completed', ({ id, result }) => {
        expect(result).toBe(42);
        done();
      });

      queue.add({ type: 'immediate', data: { value: 21 } });
    });
  });

  describe('priority', () => {
    it('should process higher priority tasks first', (done) => {
      const order = [];

      queue.registerHandler('prio', async (data) => {
        await new Promise(r => setTimeout(r, data.delay));
        order.push(data.id);
        return data.id;
      });

      queue.add({ type: 'prio', data: { id: 3, delay: 100 }, priority: 0 });
      queue.add({ type: 'prio', data: { id: 1, delay: 30 }, priority: 10 });
      queue.add({ type: 'prio', data: { id: 2, delay: 50 }, priority: 5 });

      queue.on('task:completed', () => {
        if (order.length === 3) {
          expect(order).toEqual([1, 2, 3]);
          done();
        }
      });
    });
  });

  describe('timeout', () => {
    it('should timeout long-running tasks', (done) => {
      queue.registerHandler('slow', async () => {
        await new Promise(r => setTimeout(r, 5000));
        return 'done';
      });

      queue.on('task:failed', ({ id, error }) => {
        expect(error).toContain('timed out');
        done();
      });

      queue.add({ type: 'slow', data: {}, timeout: 100 });
    });
  });

  describe('cancel', () => {
    it('should cancel a queued task', () => {
      queue.registerHandler('t', async (d) => d);
      const t1 = queue.add({ type: 't', data: {} });
      const t2 = queue.add({ type: 't', data: {} }); // queued (concurrency=2)
      const result = queue.cancel(t2.id);
      expect(result).toBe(true);
    });

    it('should cancel all tasks for a socket', () => {
      queue.registerHandler('t', async (d) => d);
      queue.add({ type: 't', data: {}, socketId: 'sock1' });
      queue.add({ type: 't', data: {}, socketId: 'sock1' });
      queue.add({ type: 't', data: {}, socketId: 'sock2' });

      const count = queue.cancelBySocket('sock1');
      expect(count).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return null for unknown task', () => {
      expect(queue.getStatus('nope')).toBeNull();
    });

    it('should return task status', () => {
      queue.registerHandler('t', async (d) => d);
      const task = queue.add({ type: 't', data: {} });
      const status = queue.getStatus(task.id);
      expect(status).toBeDefined();
      expect(status.id).toBe(task.id);
    });
  });

  describe('stats', () => {
    it('should return queue statistics', () => {
      queue.registerHandler('t', async (d) => d);
      queue.add({ type: 't', data: {} });
      const stats = queue.stats();
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('concurrency');
      expect(stats.concurrency).toBe(2);
    });
  });

  describe('concurrency', () => {
    it('should not exceed max concurrency', (done) => {
      let running = 0;
      let maxRunning = 0;

      queue.registerHandler('conc', async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(r => setTimeout(r, 50));
        running--;
      });

      queue.on('task:completed', () => {
        if (queue.stats().completed === 4) {
          expect(maxRunning).toBeLessThanOrEqual(2);
          done();
        }
      });

      for (let i = 0; i < 4; i++) {
        queue.add({ type: 'conc', data: {} });
      }
    });
  });
});
