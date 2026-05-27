import { simplifyPath } from './route-simplifier';

describe('simplifyPath', () => {
  it('should keep endpoints', () => {
    const points = [
      { lat: 45, lng: -75 },
      { lat: 45.00001, lng: -75.00001 },
      { lat: 45.00002, lng: -75.00002 },
    ];

    const simplified = simplifyPath(points, 15);

    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
  });

  it('should reduce dense straight-line routes', () => {
    const points = Array.from({ length: 50 }, (_, index) => ({
      lat: 45 + index * 0.00001,
      lng: -75 + index * 0.00001,
    }));

    const simplified = simplifyPath(points, 15);

    expect(simplified.length).toBeLessThan(points.length);
    expect(simplified).toEqual([points[0], points[points.length - 1]]);
  });

  it('should preserve meaningful bends', () => {
    const points = [
      { lat: 45, lng: -75 },
      { lat: 45.001, lng: -75 },
      { lat: 45.001, lng: -74.999 },
    ];

    const simplified = simplifyPath(points, 15);

    expect(simplified).toEqual(points);
  });
});
