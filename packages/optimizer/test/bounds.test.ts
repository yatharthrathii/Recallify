import { DEFAULT_PARAMS } from '@recallify/fsrs';
import { describe, expect, it } from 'vitest';
import { PARAM_BOUNDS, clampParams, paramRange, withinBounds } from '../src/bounds';

describe('parameter bounds', () => {
  it('covers all 21 FSRS-6 parameters', () => {
    expect(PARAM_BOUNDS).toHaveLength(21);
    expect(PARAM_BOUNDS.every(([lo, hi]) => hi > lo)).toBe(true);
  });

  it('contains the published defaults', () => {
    // If training clamped the defaults on its first step, every result would be
    // wrong from the start.
    expect(withinBounds(DEFAULT_PARAMS)).toBe(true);
    expect(clampParams(DEFAULT_PARAMS)).toEqual([...DEFAULT_PARAMS]);
  });

  it('reports the width of each range', () => {
    expect(paramRange(0)).toBeCloseTo(100 - 0.001, 6);
    expect(paramRange(4)).toBe(9);
    expect(paramRange(20)).toBeCloseTo(0.7, 10);
  });

  it('throws for an index that has no bounds', () => {
    expect(() => paramRange(99)).toThrow(RangeError);
    expect(() => paramRange(99)).toThrow('w[99]');
  });

  it('pulls out-of-range values back to the nearest edge', () => {
    const wild = DEFAULT_PARAMS.map(() => 1e6);
    const clamped = clampParams(wild);
    expect(withinBounds(clamped)).toBe(true);
    expect(clamped[4]).toBe(10);

    const negative = DEFAULT_PARAMS.map(() => -1e6);
    expect(clampParams(negative)[4]).toBe(1);
  });

  it('replaces a NaN with the midpoint instead of poisoning the run', () => {
    // A probe can push the model somewhere degenerate; one NaN must not spread
    // through every later iteration.
    const broken = [...DEFAULT_PARAMS];
    broken[8] = Number.NaN;
    broken[16] = Number.POSITIVE_INFINITY;
    const fixed = clampParams(broken);
    expect(fixed[8]).toBe(2.25);
    expect(fixed[16]).toBe(3.5);
    expect(withinBounds(fixed)).toBe(true);
  });

  it('rejects a parameter list of the wrong length', () => {
    expect(withinBounds([0.5, 0.5])).toBe(false);
    expect(withinBounds([...DEFAULT_PARAMS, 1])).toBe(false);
  });

  it('rejects a list containing a non-finite value', () => {
    const broken = [...DEFAULT_PARAMS];
    broken[0] = Number.NaN;
    expect(withinBounds(broken)).toBe(false);
  });
});
