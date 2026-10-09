import { describe, it, expect } from 'vitest';
import { BigFraction } from './BigFraction';

describe('BigFraction Exact Math Engine', () => {
  it('correctly simplifies fractions via GCD', () => {
    const f = new BigFraction(6, 8);
    expect(f.numerator).toBe(3n);
    expect(f.denominator).toBe(4n);
    expect(f.toFractionString()).toBe('3/4');
  });

  it('correctly handles statutory shares for spouse (1.5) and 2 children (1.0 each)', () => {
    // Spouse: 3/7, Child1: 2/7, Child2: 2/7
    const spouse = new BigFraction(3, 7);
    const child1 = new BigFraction(2, 7);
    const child2 = new BigFraction(2, 7);

    const sum = spouse.add(child1).add(child2);
    expect(sum.numerator).toBe(1n);
    expect(sum.denominator).toBe(1n);
    expect(sum.toFractionString()).toBe('1');
  });

  it('correctly performs subtraction and division', () => {
    const f1 = new BigFraction(3, 4);
    const f2 = new BigFraction(1, 4);
    const diff = f1.sub(f2);
    expect(diff.toFractionString()).toBe('1/2');

    const quotient = f1.div(f2);
    expect(quotient.toFractionString()).toBe('3');
  });

  it('correctly compares fractions', () => {
    const half = new BigFraction(1, 2);
    const third = new BigFraction(1, 3);
    expect(half.compare(third)).toBe(1);
    expect(third.compare(half)).toBe(-1);
    expect(half.compare(new BigFraction(2, 4))).toBe(0);
  });

  it('serializes and deserializes to/from JSON', () => {
    const original = new BigFraction(3, 7);
    const json = original.toJSON();
    expect(json).toEqual({ n: '3', d: '7' });

    const restored = BigFraction.fromJSON(json);
    expect(restored.numerator).toBe(3n);
    expect(restored.denominator).toBe(7n);
  });

  it('throws error on division by zero', () => {
    expect(() => new BigFraction(1, 0)).toThrow('Denominator cannot be zero');
    const f1 = new BigFraction(1, 2);
    const zero = new BigFraction(0, 1);
    expect(() => f1.div(zero)).toThrow('Division by zero fraction');
  });
});
