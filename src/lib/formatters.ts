const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFormatter.format(value);
}

/**
 * Format a dollar value with K/M shorthand for chart axes and compact displays.
 * e.g. 1500 → "$2K", 1234567 → "$1.2M"
 */
export function formatDollarCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Parse a currency string into a number.
 * Handles: "$1,234.56", "$ 1234.56", "1,234.56", "1234.56", "(1234.56)"
 * Ported from the Python clean_currency() pattern.
 */
export function cleanCurrencyString(val: string): number {
  if (!val || val.trim() === '') return 0;

  let cleaned = val.trim();

  // Handle negative in parentheses: (1234.56)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove $, commas, spaces
  cleaned = cleaned.replace(/[$,\s]/g, '');

  // Handle leading negative sign
  const hasNegativeSign = cleaned.startsWith('-');
  if (hasNegativeSign) {
    cleaned = cleaned.slice(1);
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  return (isNegative || hasNegativeSign) ? -num : num;
}

/**
 * Parse a month value — accepts integer (1-12) or month name string.
 * Returns 1-12 or null if invalid.
 */
export function parseMonth(val: string): number | null {
  const trimmed = val.trim();

  // Try integer
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;

  // Try month name
  const monthNames: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  return monthNames[trimmed.toLowerCase()] ?? null;
}

/**
 * Parse a date string. Accepts:
 * - ISO: 2025-01-20
 * - US: 1/20/2025, 01/20/2025
 * Returns ISO date string (YYYY-MM-DD) or null.
 */
export function parseDateString(val: string): string | null {
  const trimmed = val.trim();

  // Try ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const date = new Date(trimmed + 'T00:00:00');
    if (!isNaN(date.getTime())) return trimmed;
  }

  // Try US format: M/D/YYYY or MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const date = new Date(iso + 'T00:00:00');
    if (!isNaN(date.getTime())) return iso;
  }

  return null;
}
