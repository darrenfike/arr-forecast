'use client';

import { useState } from 'react';
import { useAppContext } from '@/lib/context';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { GrowthCharts } from '@/components/dashboard/GrowthCharts';
import { DateRangeFilter, DateRange } from '@/components/ui/DateRangeFilter';

const DEFAULT_DATE_RANGE: DateRange = {
  start: '2026-01',
  end: '2026-12',
};

export default function DashboardPage() {
  const { state } = useAppContext();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">Overview of your merchant portfolio</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <DashboardKPIs customers={state.customers} dateRange={dateRange} />
      <GrowthCharts customers={state.customers} dateRange={dateRange} />
    </main>
  );
}
