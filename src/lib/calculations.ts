import {
  CSVRow,
  Customer,
  MonthlyBenchmark,
  MerchantForecast,
  ForecastSummary,
} from './types';
import { FORECAST_YEAR, DEFAULT_BENCHMARKS } from './constants';

/**
 * Get the number of days in a given month/year.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Determine if a merchant is "live" based on their onboard date.
 * If the onboard date is today or in the past, the merchant is live.
 * If the onboard date is in the future (or missing), the merchant is not yet live.
 */
export function isMerchantLive(row: CSVRow): boolean {
  if (!row.onboardDate) return false;
  const onboard = new Date(row.onboardDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return onboard <= today;
}

/**
 * Check if a merchant has actual monthly revenue data in their CSV columns.
 * Used to decide the calculation path (extrapolate from actuals vs use estimates).
 */
export function hasMonthlyData(row: CSVRow): boolean {
  return row.monthlyData.some(m => m.processingRevenue > 0 || m.saasRevenue > 0);
}

/**
 * Get the total ARR for a Customer record.
 *
 * Uses forecastedAnnualProcessingRevenue and monthlySaasRevenue when available.
 * Falls back to extrapolating from monthlyData entries using benchmarks when
 * the stored forecast values are 0 (e.g. customers auto-created from CSV with
 * monthly data columns but empty estimated annual columns).
 */
export function getCustomerARR(
  customer: Customer,
  benchmarks: MonthlyBenchmark[] = DEFAULT_BENCHMARKS
): number {
  let processingARR = customer.forecastedAnnualProcessingRevenue;
  let saasARR = customer.monthlySaasRevenue * 12;

  // If processing ARR is 0, extrapolate from monthlyData
  if (processingARR === 0) {
    let totalProcessing = 0;
    let benchmarkPctCovered = 0;
    for (const [monthKey, data] of Object.entries(customer.monthlyData)) {
      if (data.paymentsRevenue > 0) {
        const monthNum = parseInt(monthKey.split('-')[1], 10);
        const benchmark = benchmarks.find(b => b.month === monthNum);
        const pct = benchmark?.percentage ?? (100 / 12);
        totalProcessing += data.paymentsRevenue;
        benchmarkPctCovered += pct;
      }
    }
    if (benchmarkPctCovered > 0) {
      processingARR = totalProcessing / (benchmarkPctCovered / 100);
    }
  }

  // If SaaS ARR is 0, extrapolate from monthlyData
  if (saasARR === 0) {
    let totalSaas = 0;
    let saasMonths = 0;
    for (const [, data] of Object.entries(customer.monthlyData)) {
      if (data.saasRevenue > 0) {
        totalSaas += data.saasRevenue;
        saasMonths++;
      }
    }
    if (saasMonths > 0) {
      saasARR = (totalSaas / saasMonths) * 12;
    }
  }

  return processingARR + saasARR;
}

/**
 * Calculate proration info for the onboard month.
 *
 * If onboard date is Jan 20:
 *   activeDays = 31 - 20 + 1 = 12 (Jan 20 through Jan 31 inclusive)
 *
 * Returns info about the onboard month or null if no onboard date.
 */
export function calculateProration(
  onboardDate: Date
): { activeDays: number; daysInMonth: number; onboardMonth: number; onboardYear: number; isPartial: boolean } {
  const month = onboardDate.getMonth() + 1; // 1-12
  const year = onboardDate.getFullYear();
  const day = onboardDate.getDate();
  const daysInMonth = getDaysInMonth(year, month);

  if (day === 1) {
    return { activeDays: daysInMonth, daysInMonth, onboardMonth: month, onboardYear: year, isPartial: false };
  }

  const activeDays = daysInMonth - day + 1;
  return { activeDays, daysInMonth, onboardMonth: month, onboardYear: year, isPartial: true };
}

/**
 * Core forecasting function for a single merchant.
 *
 * NOT-YET-LIVE merchants (have estimated annual values, no monthly data):
 *   - forecastedAnnualTransactional = estimatedAnnualPaymentsRevenue
 *   - annualSaasRevenue = monthlySaasFee * 12
 *   - totalARR = forecastedAnnualTransactional + annualSaasRevenue
 *
 * LIVE merchants (have actual monthly data):
 *   - Sum actual monthly processing revenues (prorating the onboard month)
 *   - Use benchmark percentages to extrapolate to annual
 *   - annualSaasRevenue = monthlySaasFee * 12 if provided, else extrapolate from actuals
 *   - totalARR = forecastedAnnualTransactional + annualSaasRevenue
 */
export function calculateMerchantForecast(
  row: CSVRow,
  benchmarks: MonthlyBenchmark[]
): MerchantForecast {
  const onboardDate = row.onboardDate ? new Date(row.onboardDate + 'T00:00:00') : new Date();
  const isLive = isMerchantLive(row);
  const hasActuals = hasMonthlyData(row);

  // If onboard date is before Jan 1 of the forecast year, treat as full-year start (no proration).
  // Revenue data columns represent the forecast year, so older onboard dates don't need proration.
  const forecastYearStart = new Date(`${FORECAST_YEAR}-01-01T00:00:00`);
  const effectiveOnboardDate = onboardDate < forecastYearStart ? forecastYearStart : onboardDate;
  const proration = calculateProration(effectiveOnboardDate);

  let forecastedAnnualTransactional = 0;
  let annualSaasRevenue = 0;

  if (!hasActuals) {
    // ── No monthly data — use estimated annual values directly ────
    forecastedAnnualTransactional = row.estimatedAnnualPaymentsRevenue;
    annualSaasRevenue = row.monthlySaasFee * 12;
  } else {
    // ── Has monthly data — extrapolate to annual using benchmarks ─
    let totalActualProcessing = 0;
    let benchmarkPctCovered = 0;

    for (let m = 0; m < 12; m++) {
      const monthData = row.monthlyData[m];
      if (monthData.processingRevenue > 0) {
        let revenue = monthData.processingRevenue;
        const monthNum = m + 1; // 1-12
        const benchmark = benchmarks.find(b => b.month === monthNum);
        const benchmarkPct = benchmark?.percentage ?? (100 / 12);

        // Prorate the onboard month if this is the month the merchant onboarded
        if (proration.isPartial && monthNum === proration.onboardMonth) {
          // Scale partial month to full month
          revenue = revenue * (proration.daysInMonth / proration.activeDays);
        }

        totalActualProcessing += revenue;
        benchmarkPctCovered += benchmarkPct;
      }
    }

    // Extrapolate: if we have X% of the year covered, annual = total / (X / 100)
    if (benchmarkPctCovered > 0) {
      forecastedAnnualTransactional = totalActualProcessing / (benchmarkPctCovered / 100);
    }

    // SaaS: use monthlySaasFee if provided, else extrapolate from actual monthly SaaS
    if (row.monthlySaasFee > 0) {
      annualSaasRevenue = row.monthlySaasFee * 12;
    } else {
      let totalActualSaas = 0;
      let saasMonths = 0;
      for (let m = 0; m < 12; m++) {
        if (row.monthlyData[m].saasRevenue > 0) {
          totalActualSaas += row.monthlyData[m].saasRevenue;
          saasMonths++;
        }
      }
      if (saasMonths > 0) {
        annualSaasRevenue = (totalActualSaas / saasMonths) * 12;
      }
    }
  }

  const totalForecastedARR = forecastedAnnualTransactional + annualSaasRevenue;

  return {
    merchantName: row.merchantName,
    onboardDate,
    isLive,
    monthlySaasFee: row.monthlySaasFee,
    estimatedAnnualPaymentsRevenue: row.estimatedAnnualPaymentsRevenue,
    isPartialMonth: proration.isPartial,
    activeDays: proration.activeDays,
    daysInOnboardMonth: proration.daysInMonth,
    forecastedAnnualTransactional,
    annualSaasRevenue,
    totalForecastedARR,
  };
}

/**
 * Run forecasts for all merchants and produce a summary.
 */
export function calculateAllForecasts(
  rows: CSVRow[],
  benchmarks: MonthlyBenchmark[]
): { forecasts: MerchantForecast[]; summary: ForecastSummary } {
  const forecasts = rows.map(row =>
    calculateMerchantForecast(row, benchmarks)
  );

  const liveMerchantCount = forecasts.filter(f => f.isLive).length;

  const liveForecasts = forecasts.filter(f => f.isLive);

  const summary: ForecastSummary = {
    merchantCount: forecasts.length,
    liveMerchantCount,
    notLiveMerchantCount: forecasts.length - liveMerchantCount,
    totalForecastedTransactional: forecasts.reduce((s, f) => s + f.forecastedAnnualTransactional, 0),
    totalAnnualSaas: forecasts.reduce((s, f) => s + f.annualSaasRevenue, 0),
    totalARR: forecasts.reduce((s, f) => s + f.totalForecastedARR, 0),
    liveARR: liveForecasts.reduce((s, f) => s + f.totalForecastedARR, 0),
    averageARRPerMerchant: 0,
  };
  summary.averageARRPerMerchant = summary.merchantCount > 0
    ? summary.totalARR / summary.merchantCount
    : 0;

  return { forecasts, summary };
}
