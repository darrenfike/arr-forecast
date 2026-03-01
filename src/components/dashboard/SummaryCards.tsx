'use client';

import { DollarSign, Users, TrendingUp, Monitor, Activity, BarChart3 } from 'lucide-react';
import { ForecastSummary } from '@/lib/types';
import { StatCard } from '@/components/ui/Card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';

interface SummaryCardsProps {
  summary: ForecastSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard
        label="Total Forecasted ARR"
        value={formatCurrencyCompact(summary.totalARR)}
        subtext="Transactional + SaaS"
        icon={<DollarSign className="w-5 h-5" />}
        accentColor="green"
      />
      <StatCard
        label="Avg ARR per Merchant"
        value={formatCurrency(summary.averageARRPerMerchant)}
        subtext={`Across ${summary.merchantCount} merchant${summary.merchantCount !== 1 ? 's' : ''}`}
        icon={<BarChart3 className="w-5 h-5" />}
        accentColor="blue"
      />
      <StatCard
        label="Total Merchants"
        value={summary.merchantCount.toString()}
        subtext={`${summary.liveMerchantCount} live, ${summary.notLiveMerchantCount} not yet live`}
        icon={<Users className="w-5 h-5" />}
        accentColor="purple"
      />
      <StatCard
        label="Forecasted Transactional"
        value={formatCurrencyCompact(summary.totalForecastedTransactional)}
        subtext="Annual payment processing revenue"
        icon={<TrendingUp className="w-5 h-5" />}
        accentColor="indigo"
      />
      <StatCard
        label="Total Annual SaaS"
        value={formatCurrencyCompact(summary.totalAnnualSaas)}
        subtext="Software subscription revenue"
        icon={<Monitor className="w-5 h-5" />}
        accentColor="amber"
      />
      <StatCard
        label="ACV (Live Customers)"
        value={summary.liveMerchantCount > 0 ? formatCurrencyCompact(summary.liveARR / summary.liveMerchantCount) : '$0'}
        subtext={`${summary.liveMerchantCount} live customer${summary.liveMerchantCount !== 1 ? 's' : ''}`}
        icon={<Activity className="w-5 h-5" />}
        accentColor="rose"
      />
    </div>
  );
}
