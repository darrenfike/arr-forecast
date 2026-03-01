import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDollarCompact,
  formatPercent,
  cleanCurrencyString,
  parseMonth,
  parseDateString,
} from '../formatters';

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
  it('formats negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });
});

describe('formatCurrencyCompact', () => {
  it('rounds to whole dollars', () => {
    expect(formatCurrencyCompact(1234.56)).toBe('$1,235');
  });
});

describe('formatDollarCompact', () => {
  it('formats millions', () => {
    expect(formatDollarCompact(1_500_000)).toBe('$1.5M');
  });
  it('formats thousands', () => {
    expect(formatDollarCompact(45_000)).toBe('$45K');
  });
  it('formats small amounts', () => {
    expect(formatDollarCompact(500)).toBe('$500');
  });
  it('formats zero', () => {
    expect(formatDollarCompact(0)).toBe('$0');
  });
  it('formats exactly 1 million', () => {
    expect(formatDollarCompact(1_000_000)).toBe('$1.0M');
  });
  it('formats exactly 1 thousand', () => {
    expect(formatDollarCompact(1_000)).toBe('$1K');
  });
});

describe('formatPercent', () => {
  it('formats with default decimals', () => {
    expect(formatPercent(5.2)).toBe('5.20%');
  });
  it('formats with 0 decimals', () => {
    expect(formatPercent(5.2, 0)).toBe('5%');
  });
  it('formats with 1 decimal', () => {
    expect(formatPercent(12.72, 1)).toBe('12.7%');
  });
});

describe('cleanCurrencyString', () => {
  it('parses simple number', () => {
    expect(cleanCurrencyString('1234.56')).toBe(1234.56);
  });
  it('parses with dollar sign', () => {
    expect(cleanCurrencyString('$1,234.56')).toBe(1234.56);
  });
  it('parses with spaces', () => {
    expect(cleanCurrencyString('$ 1234.56')).toBe(1234.56);
  });
  it('parses parenthetical negatives', () => {
    expect(cleanCurrencyString('(1234.56)')).toBe(-1234.56);
  });
  it('parses negative sign', () => {
    expect(cleanCurrencyString('-$1,234.56')).toBe(-1234.56);
  });
  it('returns 0 for empty string', () => {
    expect(cleanCurrencyString('')).toBe(0);
  });
  it('returns 0 for whitespace', () => {
    expect(cleanCurrencyString('   ')).toBe(0);
  });
  it('returns 0 for non-numeric', () => {
    expect(cleanCurrencyString('abc')).toBe(0);
  });
  it('parses integer', () => {
    expect(cleanCurrencyString('50000')).toBe(50000);
  });
});

describe('parseMonth', () => {
  it('parses integer months', () => {
    expect(parseMonth('1')).toBe(1);
    expect(parseMonth('12')).toBe(12);
  });
  it('parses full month names', () => {
    expect(parseMonth('January')).toBe(1);
    expect(parseMonth('december')).toBe(12);
  });
  it('parses abbreviated month names', () => {
    expect(parseMonth('Jan')).toBe(1);
    expect(parseMonth('sep')).toBe(9);
    expect(parseMonth('sept')).toBe(9);
  });
  it('returns null for invalid', () => {
    expect(parseMonth('13')).toBeNull();
    expect(parseMonth('0')).toBeNull();
    expect(parseMonth('xyz')).toBeNull();
  });
  it('trims whitespace', () => {
    expect(parseMonth('  3  ')).toBe(3);
  });
});

describe('parseDateString', () => {
  it('parses ISO format', () => {
    expect(parseDateString('2026-03-15')).toBe('2026-03-15');
  });
  it('parses US format M/D/YYYY', () => {
    expect(parseDateString('3/15/2026')).toBe('2026-03-15');
  });
  it('parses US format MM/DD/YYYY', () => {
    expect(parseDateString('03/15/2026')).toBe('2026-03-15');
  });
  it('parses with dashes (US)', () => {
    expect(parseDateString('3-15-2026')).toBe('2026-03-15');
  });
  it('returns null for invalid', () => {
    expect(parseDateString('not a date')).toBeNull();
    expect(parseDateString('')).toBeNull();
  });
  it('trims whitespace', () => {
    expect(parseDateString('  2026-01-01  ')).toBe('2026-01-01');
  });
});
