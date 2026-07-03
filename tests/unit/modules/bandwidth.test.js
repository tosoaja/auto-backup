const interfaces = require('../../../src/modules/bandwidth/commands/interfaces');

describe('bandwidth/interfaces', () => {
  it('should return network interfaces excluding loopback', () => {
    const r = interfaces({});
    expect(r).toHaveProperty('interfaces');
    expect(Array.isArray(r.interfaces)).toBe(true);
    r.interfaces.forEach(iface => {
      expect(iface).toHaveProperty('name');
      expect(iface.name).not.toBe('lo');
      expect(iface).toHaveProperty('addresses');
    });
  });

  it('should include address families', () => {
    const r = interfaces({});
    r.interfaces.forEach(iface => {
      iface.addresses.forEach(addr => {
        expect(addr).toHaveProperty('family');
        expect(addr).toHaveProperty('address');
        expect(addr).toHaveProperty('mac');
      });
    });
  });
});
