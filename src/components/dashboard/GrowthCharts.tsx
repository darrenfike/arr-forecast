'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Customer } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { DEFAULT_BENCHMARKS, MONTH_NAMES } from '@/lib/constants';
import { formatDollarCompact } from '@/lib/formatters';
import { getCustomerARR } from '@/lib/calculations';

interface GrowthChartsProps {
  customers: Customer[];
  dateRange: { start: string; end: string };
}

function getMonthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function formatMonthLabel(key: string): string {
  const [, m] = key.split('-').map(Number);
  return MONTH_NAMES[m - 1]?.slice(0, 3) || key;
}

export function GrowthCharts({ customers, dateRange }: GrowthChartsProps) {
  const allMonths = useMemo(() => getMonthsBetween(dateRange.start, dateRange.end), [dateRange]);

  // Show months up through the current month where at least one customer is active
  const months = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allMonths.filter(m => {
      if (m > currentMonthKey) return false;
      return customers.some(c => {
        if (c.status === 'churned') return false;
        if (!c.launchDate) return true;
        return c.launchDate.substring(0, 7) <= m;
      });
    });
  }, [allMonths, customers]);

  const arrData = useMemo(() => {
    let prevARR = 0;
    return months.map(monthKey => {
      const monthNum = parseInt(monthKey.split('-')[1], 10);
      const benchmark = DEFAULT_BENCHMARKS.find(b => b.month === monthNum);
      const pct = benchmark ? benchmark.percentage / 100 : 1 / 12;

      // Cumulative ARR: sum of all active customers' ARR who were launched on or before this month
      let totalARR = 0;
      for (const c of customers) {
        if (c.status === 'churned') continue;
        if (c.launchDate && c.launchDate.substring(0, 7) > monthKey) continue;

        if (c.monthlyData[monthKey]?.isOverride) {
          // Use override values, annualized via benchmark
          const monthlyPayments = c.monthlyData[monthKey].paymentsRevenue;
          const monthlySaas = c.monthlyData[monthKey].saasRevenue;
          totalARR += (monthlyPayments / pct) + (monthlySaas * 12);
        } else {
          // Use stored forecast values, with fallback to monthlyData extrapolation
          totalARR += getCustomerARR(c);
        }
      }

      const momChange = prevARR > 0 ? ((totalARR - prevARR) / prevARR) * 100 : 0;
      prevARR = totalARR;

      return {
        month: formatMonthLabel(monthKey),
        monthKey,
        totalARR,
        momChange: parseFloat(momChange.toFixed(1)),
      };
    });
  }, [months, customers]);

  const customerData = useMemo(() => {
    return months.map(monthKey => {
      // Cumulative: customers launched on or before this month
      const cumulative = customers.filter(c => {
        if (!c.launchDate) return true; // no launch date = already live
        return c.launchDate.substring(0, 7) <= monthKey;
      }).length;

      // New this month
      const newThisMonth = customers.filter(c => {
        if (!c.launchDate) return false;
        return c.launchDate.substring(0, 7) === monthKey;
      }).length;

      return {
        month: formatMonthLabel(monthKey),
        monthKey,
        totalCustomers: cumulative,
        newCustomers: newThisMonth,
      };
    });
  }, [months, customers]);

  if (customers.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Monthly ARR Growth">
          <div className="h-64 flex items-center justify-center text-sm text-gray-500">
            Add customers to see ARR growth trends
          </div>
        </Card>
        <Card title="Customer Growth">
          <div className="h-64 flex items-center justify-center text-sm text-gray-500">
            Add customers to see onboarding trends
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Monthly ARR Growth" subtitle="Cumulative ARR with month-over-month change">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={arrData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                tickFormatter={formatDollarCompact}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const num = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
                  if (name === 'totalARR') return [formatDollarCompact(num), 'Total ARR'];
                  if (name === 'momChange') return [`${num}%`, 'MoM Change'];
                  return [num, name];
                }}
              />
              <Legend
                formatter={(value) => {
                  if (value === 'totalARR') return 'Total ARR';
                  if (value === 'momChange') return 'MoM Change %';
                  return value;
                }}
              />
              <Bar yAxisId="left" dataKey="totalARR" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              <Line yAxisId="right" dataKey="momChange" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Customer Growth" subtitle="Cumulative customers with new onboardings">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={customerData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip />
              <Legend
                formatter={(value) => {
                  if (value === 'totalCustomers') return 'Total Customers';
                  if (value === 'newCustomers') return 'New This Month';
                  return value;
                }}
              />
              <Bar yAxisId="left" dataKey="totalCustomers" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
              <Line yAxisId="right" dataKey="newCustomers" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
