import { MonthlyBenchmark } from './types';

/**
 * The forecast year, derived from the current calendar year.
 * All CSV templates, parsers, and display columns reference this value.
 */
export const FORECAST_YEAR = new Date().getFullYear();

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Default monthly benchmarks for distributing estimated annual payments revenue.
 * Users can override these in Step 2.
 */
export const DEFAULT_BENCHMARKS: MonthlyBenchmark[] = [
  { month: 1,  monthName: 'January',   percentage: 5.20 },
  { month: 2,  monthName: 'February',  percentage: 5.92 },
  { month: 3,  monthName: 'March',     percentage: 7.94 },
  { month: 4,  monthName: 'April',     percentage: 8.24 },
  { month: 5,  monthName: 'May',       percentage: 8.62 },
  { month: 6,  monthName: 'June',      percentage: 8.89 },
  { month: 7,  monthName: 'July',      percentage: 8.38 },
  { month: 8,  monthName: 'August',    percentage: 8.23 },
  { month: 9,  monthName: 'September', percentage: 7.50 },
  { month: 10, monthName: 'October',   percentage: 8.61 },
  { month: 11, monthName: 'November',  percentage: 9.75 },
  { month: 12, monthName: 'December',  percentage: 12.72 },
];

/**
 * Column headers for the CSV template.
 * Each month has 4 sub-columns: Processing Volume, Transaction Volume,
 * Processing Revenue, SaaS Revenue.
 */
export const MONTHLY_SUB_COLUMNS = [
  'Processing Volume',
  'Transaction Volume',
  'Processing Revenue',
  'SaaS Revenue',
] as const;
