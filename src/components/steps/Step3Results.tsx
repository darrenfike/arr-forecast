'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, FileDown, Users, CheckCircle } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { exportForecastsToCSV } from '@/lib/export';
import { Customer } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { ContractedARRChart, GrowthRateTile } from '@/components/dashboard/ContractedARR';
import { MerchantTable } from '@/components/dashboard/MerchantTable';

export function Step3Results() {
  const { state, dispatch } = useAppContext();
  const { forecasts, summary, config } = state;
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  if (!summary) return null;

  const handleExport = () => {
    exportForecastsToCSV(forecasts, summary);
  };

  const handleBack = () => {
    dispatch({ type: 'SET_STEP', payload: 'configure' });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleUpdateCustomerForecasts = () => {
    // Update existing customers with forecast results, preserving monthlyData from upload.
    // Track used IDs so duplicate merchant names each match a distinct existing customer.
    const usedIds = new Set<string>();
    const customers: Customer[] = forecasts.map(f => {
      const existing = state.customers.find(
        c => !usedIds.has(c.id) && c.name.toLowerCase() === f.merchantName.toLowerCase()
      );
      if (existing) usedIds.add(existing.id);
      return {
        id: existing?.id ?? crypto.randomUUID(),
        name: f.merchantName,
        status: f.isLive ? 'live' as const : 'onboarding' as const,
        source: 'csv' as const,
        launchDate: f.onboardDate.toISOString().split('T')[0],
        forecastedAnnualProcessingRevenue: f.forecastedAnnualTransactional,
        monthlySaasRevenue: f.annualSaasRevenue / 12,
        monthlyData: existing?.monthlyData ?? {},
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
    });

    // ADD_CUSTOMERS merges by name — existing customers get updated, new ones get created
    dispatch({ type: 'ADD_CUSTOMERS', payload: customers });
    setSaved(true);
    setTimeout(() => router.push('/customers'), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards summary={summary} />

      {/* Chart */}
      <MonthlyChart benchmarks={config.benchmarks} />

      {/* Contracted ARR + Growth Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ContractedARRChart forecasts={forecasts} benchmarks={config.benchmarks} />
        </div>
        <div className="flex flex-col justify-center">
          <GrowthRateTile forecasts={forecasts} benchmarks={config.benchmarks} />
        </div>
      </div>

      {/* Merchant Forecast Table */}
      <MerchantTable forecasts={forecasts} summary={summary} />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Configuration
          </Button>
          <Button variant="secondary" onClick={handleReset} icon={<RotateCcw className="w-4 h-4" />}>
            Start Over
          </Button>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExport} icon={<FileDown className="w-4 h-4" />}>
            Export to CSV
          </Button>
          <Button
            onClick={handleUpdateCustomerForecasts}
            disabled={saved}
            icon={saved ? <CheckCircle className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          >
            {saved ? 'Saved! Redirecting...' : 'Save Forecasts to Customers'}
          </Button>
        </div>
      </div>
    </div>
  );
}
