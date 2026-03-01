import Papa from 'papaparse';
import {
  CSVRow,
  CSVValidationError,
  CSVParseResult,
  MonthlyColumnData,
} from './types';
import { MONTH_NAMES, MONTHLY_SUB_COLUMNS, FORECAST_YEAR } from './constants';
import { cleanCurrencyString, parseDateString } from './formatters';

/**
 * The year used in CSV template column headers. Derived from FORECAST_YEAR.
 */
const TEMPLATE_YEAR = FORECAST_YEAR;

/**
 * Build the list of CSV headers for the template.
 * 5 merchant-level columns + 4 columns per month x 12 months = 53 total.
 */
function buildTemplateHeaders(): string[] {
  const headers = [
    'Merchant',
    'Onboard Date',
    'Monthly SaaS Fee',
    'Estimated Annual Payments Volume',
    'Estimated Annual Payments Revenue',
  ];

  for (const monthName of MONTH_NAMES) {
    for (const sub of MONTHLY_SUB_COLUMNS) {
      headers.push(`${monthName} ${TEMPLATE_YEAR} ${sub}`);
    }
  }

  return headers;
}

/**
 * Normalize a header string for matching: lowercase, trim, collapse whitespace.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Try to find the column index for a given normalized header name from the CSV headers.
 * Returns -1 if not found.
 */
function findColumnIndex(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const normalized = normalizeHeader(candidate);
    const idx = headers.findIndex(h => normalizeHeader(h) === normalized);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Try to detect a monthly sub-column from a header string.
 * Returns { monthIndex (0-11), subColumn } or null.
 */
function parseMonthlyHeader(header: string): { monthIndex: number; subColumn: string } | null {
  const normalized = normalizeHeader(header);

  for (let m = 0; m < MONTH_NAMES.length; m++) {
    const monthLower = MONTH_NAMES[m].toLowerCase();
    // Also handle common typos like "septemer"
    const monthAliases = [monthLower];
    if (monthLower === 'september') monthAliases.push('septemer');

    for (const alias of monthAliases) {
      for (const sub of MONTHLY_SUB_COLUMNS) {
        const subLower = sub.toLowerCase();
        // Match patterns like "january 2026 processing volume" or "january processing volume"
        const withYear = `${alias} ${TEMPLATE_YEAR} ${subLower}`;
        const withoutYear = `${alias} ${subLower}`;
        if (normalized === withYear || normalized === withoutYear) {
          return { monthIndex: m, subColumn: sub };
        }
      }
    }
  }

  return null;
}

/**
 * Parse a CSV file in the wide format and return structured merchant data.
 */
export function parseCSVFile(file: File): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const errors: CSVValidationError[] = [];
        const warnings: string[] = [];
        const data: CSVRow[] = [];

        const rawRows = results.data as string[][];

        if (!rawRows || rawRows.length < 2) {
          errors.push({
            row: 0,
            field: 'file',
            value: '',
            message: 'CSV file is empty or has no data rows.',
          });
          resolve({ data, errors, warnings });
          return;
        }

        // First row is headers
        const headers = rawRows[0];

        // Find the 5 merchant-level columns
        const merchantIdx = findColumnIndex(headers, 'Merchant', 'Merchant Name', 'Name', 'DBA');
        const onboardIdx = findColumnIndex(headers, 'Onboard Date', 'Onboarded Date', 'Go Live Date', 'Go-Live Date', 'Boarded Date', 'Start Date', 'Live Date');
        const saasFeeIdx = findColumnIndex(headers, 'Monthly SaaS Fee', 'Monthly Saas Fee', 'SaaS Fee');
        const estVolumeIdx = findColumnIndex(headers, 'Estimated Annual Payments Volume', 'Est Annual Payments Volume', 'Annual Payments Volume');
        const estRevenueIdx = findColumnIndex(headers, 'Estimated Annual Payments Revenue', 'Est Annual Payments Revenue', 'Annual Payments Revenue');

        if (merchantIdx === -1) {
          errors.push({ row: 0, field: 'Merchant', value: '', message: 'Required column not found: "Merchant". Expected a column named Merchant, Merchant Name, Name, or DBA.' });
        }
        if (onboardIdx === -1) {
          errors.push({ row: 0, field: 'Onboard Date', value: '', message: 'Required column not found: "Onboard Date". Expected a column named Onboard Date, Go Live Date, or similar.' });
        }

        if (errors.length > 0) {
          resolve({ data, errors, warnings });
          return;
        }

        // Build monthly column mapping: for each header, determine if it's a monthly sub-column
        // monthlyMap[headerIdx] = { monthIndex, subColumn }
        const monthlyMap: Map<number, { monthIndex: number; subColumn: string }> = new Map();
        for (let i = 0; i < headers.length; i++) {
          const parsed = parseMonthlyHeader(headers[i]);
          if (parsed) {
            monthlyMap.set(i, parsed);
          }
        }

        if (monthlyMap.size === 0) {
          warnings.push('No monthly data columns detected in CSV. Monthly actuals will be empty — forecasting will use estimated annual values only.');
        }

        // Parse data rows
        for (let r = 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          const rowNum = r + 1; // 1-indexed for user display

          // Merchant name
          const merchantName = (row[merchantIdx] ?? '').trim();
          if (!merchantName) {
            // Skip completely empty rows silently
            if (row.every(cell => !(cell ?? '').trim())) continue;
            errors.push({ row: rowNum, field: 'Merchant', value: '', message: 'Merchant name is required.' });
            continue;
          }

          // Onboard date
          const dateStr = (row[onboardIdx] ?? '').trim();
          const onboardDate = dateStr ? parseDateString(dateStr) : null;
          if (dateStr && !onboardDate) {
            errors.push({ row: rowNum, field: 'Onboard Date', value: dateStr, message: `Cannot parse date: "${dateStr}". Use YYYY-MM-DD or M/D/YYYY.` });
            continue;
          }

          // Monthly SaaS Fee
          const saasFeeStr = saasFeeIdx >= 0 ? (row[saasFeeIdx] ?? '') : '';
          const monthlySaasFee = cleanCurrencyString(saasFeeStr);

          // Estimated Annual Payments Volume
          const estVolStr = estVolumeIdx >= 0 ? (row[estVolumeIdx] ?? '') : '';
          const estimatedAnnualPaymentsVolume = cleanCurrencyString(estVolStr);

          // Estimated Annual Payments Revenue
          const estRevStr = estRevenueIdx >= 0 ? (row[estRevenueIdx] ?? '') : '';
          const estimatedAnnualPaymentsRevenue = cleanCurrencyString(estRevStr);

          // Monthly data — initialize 12 months with zeros
          const monthlyData: MonthlyColumnData[] = Array.from({ length: 12 }, () => ({
            processingVolume: 0,
            transactionVolume: 0,
            processingRevenue: 0,
            saasRevenue: 0,
          }));

          // Fill in monthly data from mapped columns
          for (const [colIdx, { monthIndex, subColumn }] of monthlyMap) {
            const cellValue = cleanCurrencyString(row[colIdx] ?? '');
            if (cellValue !== 0) {
              switch (subColumn) {
                case 'Processing Volume':
                  monthlyData[monthIndex].processingVolume = cellValue;
                  break;
                case 'Transaction Volume':
                  monthlyData[monthIndex].transactionVolume = cellValue;
                  break;
                case 'Processing Revenue':
                  monthlyData[monthIndex].processingRevenue = cellValue;
                  break;
                case 'SaaS Revenue':
                  monthlyData[monthIndex].saasRevenue = cellValue;
                  break;
              }
            }
          }

          data.push({
            merchantName,
            onboardDate: onboardDate ?? '',
            monthlySaasFee,
            estimatedAnnualPaymentsVolume,
            estimatedAnnualPaymentsRevenue,
            monthlyData,
          });
        }

        if (data.length === 0 && errors.length === 0) {
          errors.push({ row: 0, field: 'file', value: '', message: 'No valid merchant rows found in the CSV file.' });
        }

        resolve({ data, errors, warnings });
      },
      error: (error) => {
        resolve({
          data: [],
          errors: [{
            row: 0,
            field: 'file',
            value: '',
            message: `CSV parse error: ${error.message}`,
          }],
          warnings: [],
        });
      },
    });
  });
}

/**
 * Generate a CSV template string matching the new wide format.
 */
export function generateCSVTemplate(): string {
  const headers = buildTemplateHeaders();

  const sampleRows = [
    // Not-yet-live merchant: has estimated values, no monthly data
    [
      'New Store Example', '2026-03-15', '150.00', '1000000', '50000',
      ...Array(48).fill(''),
    ],
    // Live merchant: has actual monthly data for Jan and Feb
    [
      'Bronx Wine Co', '2025-08-05', '', '', '',
      '125000', '3200', '533.50', '150.00',  // January
      '140000', '3500', '612.25', '150.00',  // February
      ...Array(40).fill(''),                  // March-December empty
    ],
  ];

  const lines = [headers.join(',')];
  for (const row of sampleRows) {
    lines.push(row.map(cell => {
      const str = cell?.toString() ?? '';
      if (str.includes(',') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','));
  }

  return lines.join('\n');
}
