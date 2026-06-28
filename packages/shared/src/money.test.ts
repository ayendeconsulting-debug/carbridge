import { describe, it, expect } from 'vitest';
import { roundMoney, formatMoney } from './money';

describe('roundMoney — half-up', () => {
  it('rounds CAD to cents', () => {
    expect(roundMoney('2.345', 'CAD').toFixed(2)).toBe('2.35');
    expect(roundMoney('2.344', 'CAD').toFixed(2)).toBe('2.34');
  });
  it('rounds NGN to whole naira', () => {
    expect(roundMoney('1233.5', 'NGN').toFixed(0)).toBe('1234');
    expect(roundMoney('1234.5', 'NGN').toFixed(0)).toBe('1235');
    expect(roundMoney('0.5', 'NGN').toFixed(0)).toBe('1');
  });
});

describe('formatMoney', () => {
  it('groups thousands with the right symbol', () => {
    expect(formatMoney('28221200', 'NGN')).toBe('₦28,221,200');
    expect(formatMoney('24540.17', 'CAD')).toBe('$24,540.17');
    expect(formatMoney('1750', 'CAD')).toBe('$1,750.00');
  });
  it('handles zero and negatives', () => {
    expect(formatMoney('0', 'NGN')).toBe('₦0');
    expect(formatMoney('0', 'CAD')).toBe('$0.00');
    expect(formatMoney('-12.5', 'CAD')).toBe('-$12.50');
  });
});
