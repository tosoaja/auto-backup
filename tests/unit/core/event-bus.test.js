const EventBus = require('../../../src/core/event-bus');

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('emit and on', () => {
    it('should emit and receive events', () => {
      const handler = jest.fn();
      bus.on('test.event', handler);
      bus.emit('test.event', { foo: 'bar' });
      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should support multiple handlers', () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      bus.on('test.event', h1);
      bus.on('test.event', h2);
      bus.emit('test.event', { data: 1 });
      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should only fire once', () => {
      const handler = jest.fn();
      bus.once('test.event', handler);
      bus.emit('test.event', 1);
      bus.emit('test.event', 2);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitFor', () => {
    it('should resolve on matching event', async () => {
      setTimeout(() => bus.emit('test.event', 'data'), 10);
      const result = await bus.waitFor('test.event', 1000);
      expect(result).toBe('data');
    });

    it('should reject on timeout', async () => {
      await expect(bus.waitFor('never.emitted', 100)).rejects.toThrow('Timeout');
    });
  });

  describe('getHistory', () => {
    it('should track event history', () => {
      bus.emit('e1', 1);
      bus.emit('e2', 2);
      bus.emit('e1', 3);
      expect(bus.getHistory().length).toBe(3);
      expect(bus.getHistory('e1').length).toBe(2);
    });

    it('should enforce max history', () => {
      for (let i = 0; i < 1500; i++) {
        bus.emit('e', i);
      }
      expect(bus.getHistory().length).toBe(1000);
    });
  });

  describe('unsubscribe', () => {
    it('should return unsubscribe function from on()', () => {
      const handler = jest.fn();
      const unsubscribe = bus.on('test', handler);
      unsubscribe();
      bus.emit('test', 'data');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
