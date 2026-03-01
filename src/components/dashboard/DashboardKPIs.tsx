'use client';

import { Users, BarChart3, DollarSign, FileText } from 'lucide-react';
import { Customer } from '@/lib/types';
import { StatCard } from '@/components/ui/Card';
import { formatCurrencyCompact } from '@/lib/formatters';
import { getCustomerARR } from '@/lib/calculations';

interface DashboardKPIsProps {
  customers: Customer[];
  dateRange: { start: string; end: string };
}

export function DashboardKPIs({ customers, dateRange }: DashboardKPIsProps) {
  const liveCustomers = customers.filter(c => c.status === 'live');
  const liveCount = liveCustomers.length;

  // Live ARR = ARR from live customers only
  const liveARR = liveCustomers.reduce((sum, c) => sum + getCustomerARR(c), 0);

  // ACV = Live ARR / number of live customers
  const acv = liveCount > 0 ? liveARR / liveCount : 0;

  // CARR = Contracted ARR from deals not yet live (onboarding)
  const onboardingCustomers = customers.filter(c => c.status === 'onboarding');
  const carr = onboardingCustomers.reduce((sum, c) => sum + getCustomerARR(c), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Live Customers"
        value={liveCount.toString()}
        subtext={`${customers.length} total`}
        icon={<Users className="w-5 h-5" />}
        accentColor="green"
      />
      <StatCard
        label="ACV"
        value={formatCurrencyCompact(acv)}
        subtext={`Across ${liveCount} live customer${liveCount !== 1 ? 's' : ''}`}
        icon={<BarChart3 className="w-5 h-5" />}
        accentColor="purple"
      />
      <StatCard
        label="Live ARR"
        value={formatCurrencyCompact(liveARR)}
        subtext={`${liveCount} live customer${liveCount !== 1 ? 's' : ''}`}
        icon={<DollarSign className="w-5 h-5" />}
        accentColor="green"
      />
      <StatCard
        label="Contracted ARR"
        value={formatCurrencyCompact(carr)}
        subtext={`${onboardingCustomers.length} pending deal${onboardingCustomers.length !== 1 ? 's' : ''}`}
        icon={<FileText className="w-5 h-5" />}
        accentColor="blue"
      />
    </div>
  );
}
