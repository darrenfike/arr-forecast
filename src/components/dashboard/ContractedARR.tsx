'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { MerchantForecast, MonthlyBenchmark } from '@/lib/types';
import { Card, StatCard } from '@/components/ui/Card';
import { formatDollarCompact } from '@/lib/formatters';
import { MONTH_NAMES } from '@/lib/constants';

const SHORT_MONTHS = MONTH_NAMES.map(m => m.slice(0, 3));

interface ContractedARRProps {
  forecasts: MerchantForecast[];
  benchmarks: MonthlyBenchmark[];
}

/**
 * Column chart showing contracted (not-yet-live) customers' forecasted ARR,
 * attributed to the month of their go-live date.
 */
export function ContractedARRChart({ forecasts }: ContractedARRProps) {
  const chartData = useMemo(() => {
    // Filter to not-yet-live customers only
    const notLive = forecasts.filter(f => !f.isLive);

    // Group ARR by onboard month
    const monthlyARR = new Array(12).fill(0);
    const monthlyCount = new Array(12).fill(0);
    for (const f of notLive) {
      const monthIdx = f.onboardDate.getMonth(); // 0-11
      monthlyARR[monthIdx] += f.totalForecastedARR;
      monthlyCount[monthIdx]++;
    }

    return SHORT_MONTHS.map((label, i) => ({
      month: label,
      fullName: MONTH_NAMES[i],
      arr: monthlyARR[i],
      count: monthlyCount[i],
    }));
  }, [forecasts]);

  const maxARR = Math.max(...chartData.map(d => d.arr));
  const hasData = chartData.some(d => d.arr > 0);

  if (!hasData) {
    return (
      <Card title="Contracted ARR" subtitle="Forecasted ARR for not-yet-live customers by go-live month">
        <div className="h-64 flex items-center justify-center text-sm text-gray-500">
          No not-yet-live customers in the forecast
        </div>
      </Card>
    );
  }

  return (
    <Card title="Contracted ARR" subtitle="Forecasted ARR for not-yet-live customers by go-live month">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={formatDollarCompact}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, props: any) => {
                const num = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
                const count = props?.payload?.count ?? 0;
                return [
                  formatDollarCompact(num),
                  `Contracted ARR (${count} merchant${count !== 1 ? 's' : ''})`,
                ];
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => {
                const labelStr = String(label ?? '');
                const item = chartData.find(d => d.month === labelStr);
                return item?.fullName ?? labelStr;
              }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="arr" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.arr === maxARR && entry.arr > 0 ? '#7c3aed' : entry.arr > 0 ? '#c4b5fd' : '#e5e7eb'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/**
 * Tile showing the average month-over-month growth rate for live customers only.
 * Contracted (not-yet-live) ARR is excluded.
 *
 * Calculation:
 * - For each month, sum forecasted monthly revenue for all live customers
 *   whose onboard date is on or before that month.
 * - Monthly revenue = (forecastedAnnualTransactional * benchmark%) + (annualSaasRevenue / 12)
 * - Compute MoM growth rates, then average them.
 */
export function GrowthRateTile({ forecasts, benchmarks }: ContractedARRProps) {
  const { avgGrowthRate, monthlyRevenues } = useMemo(() => {
    const liveForecasts = forecasts.filter(f => f.isLive);

    if (liveForecasts.length === 0) {
      return { avgGrowthRate: 0, monthlyRevenues: [] };
    }

    // Calculate total live monthly revenue for each month
    const revenues: number[] = [];
    for (let m = 0; m < 12; m++) {
      const monthNum = m + 1;
      const benchmark = benchmarks.find(b => b.month === monthNum);
      const pct = benchmark ? benchmark.percentage / 100 : 1 / 12;

      let monthTotal = 0;
      for (const f of liveForecasts) {
        // Only include revenue for months on or after the customer's onboard month
        const onboardMonth = f.onboardDate.getMonth(); // 0-indexed
        if (m < onboardMonth) continue;

        const monthlyTransactional = f.forecastedAnnualTransactional * pct;
        const monthlySaas = f.annualSaasRevenue / 12;
        monthTotal += monthlyTransactional + monthlySaas;
      }
      revenues.push(monthTotal);
    }

    // Compute MoM growth rates for months that have positive revenue
    const growthRates: number[] = [];
    for (let m = 1; m < 12; m++) {
      if (revenues[m - 1] > 0 && revenues[m] > 0) {
        const rate = ((revenues[m] - revenues[m - 1]) / revenues[m - 1]) * 100;
        growthRates.push(rate);
      }
    }

    const avg = growthRates.length > 0
      ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
      : 0;

    return { avgGrowthRate: avg, monthlyRevenues: revenues };
  }, [forecasts, benchmarks]);

  const liveCount = forecasts.filter(f => f.isLive).length;

  return (
    <StatCard
      label="Avg Monthly Growth Rate"
      value={`${avgGrowthRate.toFixed(1)}%`}
      subtext={liveCount > 0
        ? `Based on ${liveCount} live merchant${liveCount !== 1 ? 's' : ''} (excludes contracted ARR)`
        : 'No live merchants in forecast'
      }
      icon={<TrendingUp className="w-5 h-5" />}
      accentColor="green"
    />
  );
}
