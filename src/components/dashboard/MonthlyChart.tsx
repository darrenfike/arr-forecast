'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MonthlyBenchmark } from '@/lib/types';
import { Card } from '@/components/ui/Card';

interface MonthlyChartProps {
  benchmarks: MonthlyBenchmark[];
}

export function MonthlyChart({ benchmarks }: MonthlyChartProps) {
  const data = benchmarks.map(b => ({
    month: b.monthName.slice(0, 3),
    percentage: b.percentage,
    fullName: b.monthName,
  }));

  const maxPct = Math.max(...data.map(d => d.percentage));

  return (
    <Card
      title="Monthly Revenue Distribution"
      subtitle="Percentage of annual transactional revenue expected per month"
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              tickFormatter={(val) => `${val}%`}
              domain={[0, Math.ceil(maxPct + 1)]}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => {
                const num = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
                return [`${num.toFixed(2)}%`, 'Share of Annual Revenue'];
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => {
                const labelStr = String(label ?? '');
                const item = data.find(d => d.month === labelStr);
                return item?.fullName ?? labelStr;
              }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.percentage === maxPct ? '#2563eb' : '#93c5fd'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
