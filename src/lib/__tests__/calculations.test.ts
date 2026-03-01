import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  isMerchantLive,
  hasMonthlyData,
  calculateProration,
  calculateMerchantForecast,
  calculateAllForecasts,
} from '../calculations';
import { CSVRow, MonthlyBenchmark } from '../types';
import { DEFAULT_BENCHMARKS } from '../constants';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeEmptyMonthlyData() {
  return Array.from({ length: 12 }, () => ({
    processingVolume: 0,
    transactionVolume: 0,
    processingRevenue: 0,
    saasRevenue: 0,
  }));
}

function makeNotLiveRow(overrides: Partial<CSVRow> = {}): CSVRow {
  return {
    merchantName: 'Test Merchant',
    onboardDate: '2026-06-01',
    monthlySaasFee: 200,
    estimatedAnnualPaymentsVolume: 1_000_000,
    estimatedAnnualPaymentsRevenue: 50_000,
    monthlyData: makeEmptyMonthlyData(),
    ...overrides,
  };
}

function makeLiveRow(overrides: Partial<CSVRow> = {}): CSVRow {
  const monthlyData = makeEmptyMonthlyData();
  // Jan: $500 processing revenue, $150 SaaS
  monthlyData[0].processingRevenue = 500;
  monthlyData[0].saasRevenue = 150;
  // Feb: $600 processing revenue, $150 SaaS
  monthlyData[1].processingRevenue = 600;
  monthlyData[1].saasRevenue = 150;

  return {
    merchantName: 'Live Merchant',
    onboardDate: '2025-08-05',
    monthlySaasFee: 150,
    estimatedAnnualPaymentsVolume: 0,
    estimatedAnnualPaymentsRevenue: 0,
    monthlyData,
    ...overrides,
  };
}

// ── getDaysInMonth ───────────────────────────────────────────────────────

describe('getDaysInMonth', () => {
  it('returns 31 for January', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31);
  });
  it('returns 28 for Feb in non-leap year', () => {
    expect(getDaysInMonth(2026, 2)).toBe(28);
  });
  it('returns 29 for Feb in leap year', () => {
    expect(getDaysInMonth(2028, 2)).toBe(29);
  });
  it('returns 30 for April', () => {
    expect(getDaysInMonth(2026, 4)).toBe(30);
  });
  it('returns 31 for December', () => {
    expect(getDaysInMonth(2026, 12)).toBe(31);
  });
});

// ── isMerchantLive (date-based) ──────────────────────────────────────────

describe('isMerchantLive', () => {
  it('returns true when onboard date is in the past', () => {
    expect(isMerchantLive(makeNotLiveRow({ onboardDate: '2025-01-15' }))).toBe(true);
  });
  it('returns true when onboard date is today', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(isMerchantLive(makeNotLiveRow({ onboardDate: todayStr }))).toBe(true);
  });
  it('returns false when onboard date is in the future', () => {
    expect(isMerchantLive(makeNotLiveRow({ onboardDate: '2027-06-01' }))).toBe(false);
  });
  it('returns false when onboard date is missing', () => {
    expect(isMerchantLive(makeNotLiveRow({ onboardDate: '' }))).toBe(false);
  });
  it('returns true for live row helper (past onboard date)', () => {
    // makeLiveRow has onboardDate: '2025-08-05' which is in the past
    expect(isMerchantLive(makeLiveRow())).toBe(true);
  });
});

// ── hasMonthlyData ───────────────────────────────────────────────────────

describe('hasMonthlyData', () => {
  it('returns false when all monthly data is zero', () => {
    expect(hasMonthlyData(makeNotLiveRow())).toBe(false);
  });
  it('returns true when any month has processing revenue', () => {
    const row = makeNotLiveRow();
    row.monthlyData[3].processingRevenue = 100;
    expect(hasMonthlyData(row)).toBe(true);
  });
  it('returns true when any month has SaaS revenue', () => {
    const row = makeNotLiveRow();
    row.monthlyData[5].saasRevenue = 50;
    expect(hasMonthlyData(row)).toBe(true);
  });
  it('returns true for live row helper', () => {
    expect(hasMonthlyData(makeLiveRow())).toBe(true);
  });
});

// ── calculateProration ───────────────────────────────────────────────────

describe('calculateProration', () => {
  it('returns full month when onboard date is the 1st', () => {
    const result = calculateProration(new Date('2026-01-01T00:00:00'));
    expect(result.isPartial).toBe(false);
    expect(result.activeDays).toBe(31);
    expect(result.daysInMonth).toBe(31);
    expect(result.onboardMonth).toBe(1);
    expect(result.onboardYear).toBe(2026);
  });

  it('calculates partial month for Jan 20 (12 active days)', () => {
    const result = calculateProration(new Date('2026-01-20T00:00:00'));
    expect(result.isPartial).toBe(true);
    expect(result.activeDays).toBe(12); // 31 - 20 + 1
    expect(result.daysInMonth).toBe(31);
  });

  it('calculates partial month for mid-Feb non-leap year', () => {
    const result = calculateProration(new Date('2026-02-15T00:00:00'));
    expect(result.isPartial).toBe(true);
    expect(result.activeDays).toBe(14); // 28 - 15 + 1
    expect(result.daysInMonth).toBe(28);
  });

  it('calculates partial month for last day of month', () => {
    const result = calculateProration(new Date('2026-03-31T00:00:00'));
    expect(result.isPartial).toBe(true);
    expect(result.activeDays).toBe(1); // 31 - 31 + 1
    expect(result.daysInMonth).toBe(31);
  });

  it('handles Feb 29 in leap year', () => {
    const result = calculateProration(new Date('2028-02-15T00:00:00'));
    expect(result.daysInMonth).toBe(29);
    expect(result.activeDays).toBe(15); // 29 - 15 + 1
  });
});

// ── calculateMerchantForecast ────────────────────────────────────────────

describe('calculateMerchantForecast', () => {
  describe('not-yet-live merchants', () => {
    it('uses estimated annual values directly', () => {
      const row = makeNotLiveRow({
        estimatedAnnualPaymentsRevenue: 50_000,
        monthlySaasFee: 200,
      });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);

      expect(result.isLive).toBe(false);
      expect(result.forecastedAnnualTransactional).toBe(50_000);
      expect(result.annualSaasRevenue).toBe(2_400); // 200 * 12
      expect(result.totalForecastedARR).toBe(52_400);
    });

    it('handles zero SaaS fee', () => {
      const row = makeNotLiveRow({ monthlySaasFee: 0 });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);
      expect(result.annualSaasRevenue).toBe(0);
    });

    it('handles zero estimated revenue', () => {
      const row = makeNotLiveRow({ estimatedAnnualPaymentsRevenue: 0 });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);
      expect(result.forecastedAnnualTransactional).toBe(0);
    });
  });

  describe('live merchants without monthly data', () => {
    it('uses estimated values when live but no monthly data', () => {
      // Past onboard date = live, but only has columns C/D/E (estimated values)
      const row = makeNotLiveRow({
        onboardDate: '2025-06-01',
        estimatedAnnualPaymentsRevenue: 60_000,
        monthlySaasFee: 250,
      });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);

      expect(result.isLive).toBe(true);
      expect(result.forecastedAnnualTransactional).toBe(60_000);
      expect(result.annualSaasRevenue).toBe(3_000); // 250 * 12
      expect(result.totalForecastedARR).toBe(63_000);
    });
  });

  describe('live merchants with monthly data', () => {
    it('extrapolates annual from actual monthly data', () => {
      const row = makeLiveRow();
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);

      expect(result.isLive).toBe(true);
      // Jan benchmark = 5.20%, Feb = 5.92%, total covered = 11.12%
      // total actual = 500 + 600 = 1100 (no proration since onboard is Aug 2025, before Jan)
      // annual = 1100 / 0.1112 = ~9892.09
      expect(result.forecastedAnnualTransactional).toBeCloseTo(1100 / 0.1112, 0);
    });

    it('uses monthlySaasFee * 12 for annual SaaS when fee is provided', () => {
      const row = makeLiveRow({ monthlySaasFee: 150 });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);
      expect(result.annualSaasRevenue).toBe(1800); // 150 * 12
    });

    it('extrapolates SaaS from actuals when monthlySaasFee is 0', () => {
      const row = makeLiveRow({ monthlySaasFee: 0 });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);
      // Two months of $150 SaaS each → average $150/mo → annual $1800
      expect(result.annualSaasRevenue).toBe(1800);
    });

    it('skips proration for onboard dates before the forecast year', () => {
      // Merchant onboarded Aug 5, 2025 — before forecast year, so no proration
      const monthlyData = makeEmptyMonthlyData();
      monthlyData[0].processingRevenue = 500; // January
      const row = makeLiveRow({
        onboardDate: '2025-08-05',
        monthlyData,
        monthlySaasFee: 0,
      });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);

      // Should NOT prorate — full January assumed
      expect(result.isPartialMonth).toBe(false);
      // annual = 500 / 0.052 = ~9615.38
      expect(result.forecastedAnnualTransactional).toBeCloseTo(500 / 0.052, 0);
    });

    it('prorates the onboard month correctly', () => {
      // Merchant onboards Jan 20, has Jan revenue of $500
      const monthlyData = makeEmptyMonthlyData();
      monthlyData[0].processingRevenue = 500; // January
      const row = makeLiveRow({
        onboardDate: '2026-01-20',
        monthlyData,
        monthlySaasFee: 0,
      });
      const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);

      // activeDays = 31 - 20 + 1 = 12
      // Prorated full-month = 500 * (31 / 12) = 1291.67
      // Annual = 1291.67 / 0.052 = ~24,840
      const proratedFullMonth = 500 * (31 / 12);
      const expectedAnnual = proratedFullMonth / 0.052;
      expect(result.forecastedAnnualTransactional).toBeCloseTo(expectedAnnual, 0);
      expect(result.isPartialMonth).toBe(true);
      expect(result.activeDays).toBe(12);
    });
  });

  it('handles missing onboard date gracefully', () => {
    const row = makeNotLiveRow({ onboardDate: '' });
    // Should not throw
    const result = calculateMerchantForecast(row, DEFAULT_BENCHMARKS);
    expect(result.merchantName).toBe('Test Merchant');
  });
});

// ── calculateAllForecasts ────────────────────────────────────────────────

describe('calculateAllForecasts', () => {
  it('produces correct summary for mixed live/not-live merchants', () => {
    const rows = [makeNotLiveRow(), makeLiveRow()];
    const { forecasts, summary } = calculateAllForecasts(rows, DEFAULT_BENCHMARKS);

    expect(forecasts).toHaveLength(2);
    expect(summary.merchantCount).toBe(2);
    expect(summary.liveMerchantCount).toBe(1);
    expect(summary.notLiveMerchantCount).toBe(1);
    expect(summary.totalARR).toBeGreaterThan(0);
    expect(summary.averageARRPerMerchant).toBe(summary.totalARR / 2);
  });

  it('computes liveARR from only live merchants', () => {
    const rows = [makeNotLiveRow(), makeLiveRow()];
    const { forecasts, summary } = calculateAllForecasts(rows, DEFAULT_BENCHMARKS);

    const liveForecast = forecasts.find(f => f.isLive)!;
    expect(summary.liveARR).toBe(liveForecast.totalForecastedARR);
    expect(summary.liveARR).toBeLessThan(summary.totalARR);
  });

  it('produces correct summary for empty rows', () => {
    const { forecasts, summary } = calculateAllForecasts([], DEFAULT_BENCHMARKS);
    expect(forecasts).toHaveLength(0);
    expect(summary.merchantCount).toBe(0);
    expect(summary.averageARRPerMerchant).toBe(0);
    expect(summary.liveARR).toBe(0);
  });

  it('sums total correctly', () => {
    const rows = [makeNotLiveRow(), makeNotLiveRow()];
    const { summary } = calculateAllForecasts(rows, DEFAULT_BENCHMARKS);
    // Each not-live: transactional = 50000, SaaS = 2400 → 52400
    expect(summary.totalARR).toBe(52_400 * 2);
    expect(summary.totalForecastedTransactional).toBe(50_000 * 2);
    expect(summary.totalAnnualSaas).toBe(2_400 * 2);
    // No live merchants, so liveARR = 0
    expect(summary.liveARR).toBe(0);
  });
});
