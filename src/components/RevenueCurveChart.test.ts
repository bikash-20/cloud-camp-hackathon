import { describe, expect, it } from 'vitest';
import { pointsToCatmullRomBezierPath } from './RevenueCurveChart';

describe('RevenueCurveChart Catmull-Rom spline calculations', () => {
  it('handles empty points array gracefully', () => {
    expect(pointsToCatmullRomBezierPath([])).toBe('');
  });

  it('handles single point as M move command', () => {
    expect(pointsToCatmullRomBezierPath([{ x: 10, y: 20 }])).toBe('M 10.0 20.0');
  });

  it('generates smooth cubic bezier path for multiple points', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 40 },
      { x: 150, y: 20 },
    ];
    const path = pointsToCatmullRomBezierPath(points);
    expect(path).toContain('M 0.0 100.0');
    expect(path).toContain('C ');
    // Expect 3 Bezier segments
    const segmentCount = (path.match(/ C /g) || []).length;
    expect(segmentCount).toBe(3);
  });
});
