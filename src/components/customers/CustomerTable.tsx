'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Customer, CustomerStatus } from '@/lib/types';
import { useAppContext } from '@/lib/context';
import { formatCurrency } from '@/lib/formatters';
import { DEFAULT_BENCHMARKS, FORECAST_YEAR, MONTH_NAMES } from '@/lib/constants';

// Show the last month of the prior year + the first month of the forecast year
const MONTHLY_COLUMNS = [
  { key: `${FORECAST_YEAR - 1}-12`, label: `Dec ${FORECAST_YEAR - 1}` },
  { key: `${FORECAST_YEAR}-01`, label: `Jan ${FORECAST_YEAR}` },
];

const STATUS_BADGES: Record<CustomerStatus, { label: string; classes: string }> = {
  live: { label: 'Live', classes: 'bg-green-100 text-green-700' },
  onboarding: { label: 'Signed / Onboarding', classes: 'bg-amber-100 text-amber-700' },
  churned: { label: 'Churned', classes: 'bg-red-100 text-red-700' },
};

type SortField = 'name' | 'status' | 'launchDate' | 'estARR' | 'avgMonthlyPayments' | 'monthlySaasRevenue';
type SortDirection = 'asc' | 'desc';

function getEstARR(c: Customer): number {
  return c.forecastedAnnualProcessingRevenue + (c.monthlySaasRevenue * 12);
}

function getMonthlyPayments(c: Customer, monthKey: string): number {
  if (c.monthlyData[monthKey]?.isOverride) {
    return c.monthlyData[monthKey].paymentsRevenue;
  }
  // Auto-forecast: annual * benchmark %
  const monthNum = parseInt(monthKey.split('-')[1], 10);
  const benchmark = DEFAULT_BENCHMARKS.find(b => b.month === monthNum);
  const pct = benchmark ? benchmark.percentage / 100 : 1 / 12;
  return c.forecastedAnnualProcessingRevenue * pct;
}

function getMonthlySaas(c: Customer, monthKey: string): number {
  if (c.monthlyData[monthKey]?.isOverride) {
    return c.monthlyData[monthKey].saasRevenue;
  }
  return c.monthlySaasRevenue;
}

function getAvgMonthlyPayments(c: Customer): number {
  if (MONTHLY_COLUMNS.length === 0) return 0;
  const total = MONTHLY_COLUMNS.reduce((sum, col) => sum + getMonthlyPayments(c, col.key), 0);
  return total / MONTHLY_COLUMNS.length;
}

export function CustomerTable() {
  const { state, dispatch } = useAppContext();
  const { customers } = state;
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const sorted = useMemo(() => {
    return [...customers].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'launchDate': aVal = a.launchDate ?? ''; bVal = b.launchDate ?? ''; break;
        case 'estARR': aVal = getEstARR(a); bVal = getEstARR(b); break;
        case 'avgMonthlyPayments': aVal = getAvgMonthlyPayments(a); bVal = getAvgMonthlyPayments(b); break;
        case 'monthlySaasRevenue': aVal = a.monthlySaasRevenue; bVal = b.monthlySaasRevenue; break;
        default: aVal = 0; bVal = 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-600" />
      : <ArrowDown className="w-3 h-3 text-blue-600" />;
  };

  const startEdit = useCallback((cellKey: string, currentValue: number) => {
    setEditingCell(cellKey);
    setEditValue(currentValue === 0 ? '' : currentValue.toString());
  }, []);

  const commitEdit = useCallback((customerId: string, monthKey: string, field: 'paymentsRevenue' | 'saasRevenue') => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num >= 0) {
      dispatch({
        type: 'UPDATE_MONTHLY_DATA',
        payload: {
          customerId,
          month: monthKey,
          data: { [field]: num },
        },
      });
    }
    setEditingCell(null);
    setEditValue('');
  }, [editValue, dispatch]);

  const handleDelete = (id: string) => {
    dispatch({ type: 'REMOVE_CUSTOMER', payload: id });
  };

  // Totals
  const totals = useMemo(() => {
    const estARR = customers.reduce((s, c) => s + getEstARR(c), 0);
    const avgPayments = customers.reduce((s, c) => s + getAvgMonthlyPayments(c), 0);
    const monthlySaas = customers.reduce((s, c) => s + c.monthlySaasRevenue, 0);
    const monthly: Record<string, { payments: number; saas: number }> = {};
    for (const col of MONTHLY_COLUMNS) {
      monthly[col.key] = {
        payments: customers.reduce((s, c) => s + getMonthlyPayments(c, col.key), 0),
        saas: customers.reduce((s, c) => s + getMonthlySaas(c, col.key), 0),
      };
    }
    return { estARR, avgPayments, monthlySaas, monthly };
  }, [customers]);

  if (customers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No customers yet</h3>
        <p className="text-sm text-gray-500">Add your first customer to start tracking ARR.</p>
      </div>
    );
  }

  const formatLaunchDate = (d?: string) => {
    if (!d) return '—';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {/* Fixed columns */}
            <th
              onClick={() => handleSort('name')}
              className="py-2 px-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10"
            >
              <span className="inline-flex items-center gap-1">Customer <SortIcon field="name" /></span>
            </th>
            <th
              onClick={() => handleSort('status')}
              className="py-2 px-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span>
            </th>
            <th
              onClick={() => handleSort('launchDate')}
              className="py-2 px-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1">Launch Date <SortIcon field="launchDate" /></span>
            </th>
            <th
              onClick={() => handleSort('estARR')}
              className="py-2 px-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1 justify-end">Est. ARR <SortIcon field="estARR" /></span>
            </th>
            <th
              onClick={() => handleSort('avgMonthlyPayments')}
              className="py-2 px-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1 justify-end">Avg Monthly Payments <SortIcon field="avgMonthlyPayments" /></span>
            </th>
            <th
              onClick={() => handleSort('monthlySaasRevenue')}
              className="py-2 px-3 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1 justify-end">Monthly SaaS <SortIcon field="monthlySaasRevenue" /></span>
            </th>

            {/* Monthly columns */}
            {MONTHLY_COLUMNS.map(col => (
              <th key={col.key} colSpan={2} className="py-2 px-1 text-center font-medium text-gray-500 whitespace-nowrap border-l border-gray-200">
                {col.label}
              </th>
            ))}

            <th className="py-2 px-2 w-8"></th>
          </tr>
          {/* Sub-header for monthly columns */}
          <tr className="border-b border-gray-100">
            <th colSpan={6} className="sticky left-0 bg-white z-10"></th>
            {MONTHLY_COLUMNS.map(col => (
              <React.Fragment key={col.key}>
                <th className="py-1 px-2 text-right text-xs font-normal text-gray-400 whitespace-nowrap border-l border-gray-200">Payments</th>
                <th className="py-1 px-2 text-right text-xs font-normal text-gray-400 whitespace-nowrap">SaaS</th>
              </React.Fragment>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => {
            const badge = STATUS_BADGES[c.status];
            return (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3 font-medium text-gray-900 sticky left-0 bg-white z-10 group-hover:bg-gray-50">
                  {c.name}
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="py-3 px-3 text-gray-700 text-sm">{formatLaunchDate(c.launchDate)}</td>
                <td className="py-3 px-3 text-right font-bold text-gray-900 font-mono">{formatCurrency(getEstARR(c))}</td>
                <td className="py-3 px-3 text-right text-gray-700 font-mono">{formatCurrency(getAvgMonthlyPayments(c))}</td>
                <td className="py-3 px-3 text-right text-gray-700 font-mono">{formatCurrency(c.monthlySaasRevenue)}</td>

                {/* Monthly data cells (editable) */}
                {MONTHLY_COLUMNS.map(col => {
                  const payKey = `${c.id}-${col.key}-pay`;
                  const saasKey = `${c.id}-${col.key}-saas`;
                  const payVal = getMonthlyPayments(c, col.key);
                  const saasVal = getMonthlySaas(c, col.key);
                  const isPayOverride = c.monthlyData[col.key]?.isOverride;
                  const isSaasOverride = c.monthlyData[col.key]?.isOverride;

                  return (
                    <React.Fragment key={col.key}>
                      <td className="py-3 px-2 text-right font-mono border-l border-gray-200">
                        {editingCell === payKey ? (
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(c.id, col.key, 'paymentsRevenue')}
                            onKeyDown={e => e.key === 'Enter' && commitEdit(c.id, col.key, 'paymentsRevenue')}
                            className="w-24 px-1 py-0.5 text-right text-sm border border-blue-400 rounded focus:outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(payKey, payVal)}
                            className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 ${isPayOverride ? 'text-blue-700 font-medium' : 'text-gray-600'}`}
                            title={isPayOverride ? 'Manual override' : 'Forecasted (click to edit)'}
                          >
                            {formatCurrency(payVal)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        {editingCell === saasKey ? (
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(c.id, col.key, 'saasRevenue')}
                            onKeyDown={e => e.key === 'Enter' && commitEdit(c.id, col.key, 'saasRevenue')}
                            className="w-24 px-1 py-0.5 text-right text-sm border border-blue-400 rounded focus:outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(saasKey, saasVal)}
                            className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 ${isSaasOverride ? 'text-blue-700 font-medium' : 'text-gray-600'}`}
                            title={isSaasOverride ? 'Manual override' : 'Forecasted (click to edit)'}
                          >
                            {formatCurrency(saasVal)}
                          </span>
                        )}
                      </td>
                    </React.Fragment>
                  );
                })}

                <td className="py-3 px-2">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="py-3 px-3 font-bold text-gray-900 sticky left-0 bg-gray-50 z-10">TOTALS</td>
            <td className="py-3 px-3 text-sm text-gray-500">{customers.length} customers</td>
            <td></td>
            <td className="py-3 px-3 text-right font-bold text-gray-900 font-mono">{formatCurrency(totals.estARR)}</td>
            <td className="py-3 px-3 text-right font-bold text-gray-900 font-mono">{formatCurrency(totals.avgPayments)}</td>
            <td className="py-3 px-3 text-right font-bold text-gray-900 font-mono">{formatCurrency(totals.monthlySaas)}</td>
            {MONTHLY_COLUMNS.map(col => (
              <React.Fragment key={col.key}>
                <td className="py-3 px-2 text-right font-bold text-gray-900 font-mono border-l border-gray-200">{formatCurrency(totals.monthly[col.key].payments)}</td>
                <td className="py-3 px-2 text-right font-bold text-gray-900 font-mono">{formatCurrency(totals.monthly[col.key].saas)}</td>
              </React.Fragment>
            ))}
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
