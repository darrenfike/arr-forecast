'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { MerchantForecast, ForecastSummary } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface MerchantTableProps {
  forecasts: MerchantForecast[];
  summary: ForecastSummary;
}

type SortField =
  | 'merchantName'
  | 'forecastedAnnualTransactional'
  | 'annualSaasRevenue'
  | 'totalForecastedARR';

type SortDirection = 'asc' | 'desc';

export function MerchantTable({ forecasts, summary }: MerchantTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalForecastedARR');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedForecasts = useMemo(() => {
    return [...forecasts].sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [forecasts, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  const columns: { field: SortField; label: string; align: string }[] = [
    { field: 'merchantName', label: 'Merchant', align: 'left' },
    { field: 'forecastedAnnualTransactional', label: 'Annual Transactional', align: 'right' },
    { field: 'annualSaasRevenue', label: 'Annual SaaS', align: 'right' },
    { field: 'totalForecastedARR', label: 'Total ARR', align: 'right' },
  ];

  return (
    <Card
      title="Merchant Forecast Details"
      subtitle={`${forecasts.length} merchant${forecasts.length !== 1 ? 's' : ''} — sorted by ${columns.find(c => c.field === sortField)?.label}`}
    >
      <div className="overflow-x-auto -mx-6">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map(col => (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  className={`py-2 px-4 font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.field} />
                  </span>
                </th>
              ))}
              <th className="py-2 px-4 text-left font-medium text-gray-500">Details</th>
            </tr>
          </thead>
          <tbody>
            {sortedForecasts.map((f, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="font-medium text-gray-900">{f.merchantName}</div>
                  <div className="text-xs text-gray-500">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      f.isLive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {f.isLive ? 'Live' : 'Not Live'}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-gray-700 font-mono">
                  {formatCurrency(f.forecastedAnnualTransactional)}
                </td>
                <td className="py-3 px-4 text-right text-gray-700 font-mono">
                  {formatCurrency(f.annualSaasRevenue)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">
                  {formatCurrency(f.totalForecastedARR)}
                </td>
                <td className="py-3 px-4">
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>Onboard: {formatDate(f.onboardDate)}</div>
                    {f.isPartialMonth && (
                      <div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          {f.activeDays}/{f.daysInOnboardMonth}d prorated
                        </span>
                      </div>
                    )}
                    {f.monthlySaasFee > 0 && (
                      <div>SaaS: {formatCurrency(f.monthlySaasFee)}/mo</div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals Row */}
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-3 px-4 font-bold text-gray-900">TOTALS</td>
              <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">
                {formatCurrency(summary.totalForecastedTransactional)}
              </td>
              <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">
                {formatCurrency(summary.totalAnnualSaas)}
              </td>
              <td className="py-3 px-4 text-right font-bold text-blue-700 font-mono text-base">
                {formatCurrency(summary.totalARR)}
              </td>
              <td className="py-3 px-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
