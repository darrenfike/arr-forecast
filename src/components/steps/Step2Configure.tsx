'use client';

import { useState } from 'react';
import { RotateCcw, Calculator, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { calculateAllForecasts } from '@/lib/calculations';
import { DEFAULT_BENCHMARKS } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPercent } from '@/lib/formatters';

export function Step2Configure() {
  const { state, dispatch } = useAppContext();
  const { config, csvData } = state;
  const [forecastError, setForecastError] = useState<string | null>(null);

  const benchmarkSum = config.benchmarks.reduce((s, b) => s + b.percentage, 0);

  const handleBenchmarkChange = (month: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      dispatch({ type: 'UPDATE_BENCHMARK', payload: { month, percentage: num } });
    } else if (value === '') {
      dispatch({ type: 'UPDATE_BENCHMARK', payload: { month, percentage: 0 } });
    }
  };

  const handleBenchmarkBlur = (month: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      dispatch({ type: 'UPDATE_BENCHMARK', payload: { month, percentage: 0 } });
    } else if (num > 100) {
      dispatch({ type: 'UPDATE_BENCHMARK', payload: { month, percentage: 100 } });
    }
  };

  const handleResetBenchmarks = () => {
    for (const b of DEFAULT_BENCHMARKS) {
      dispatch({ type: 'UPDATE_BENCHMARK', payload: { month: b.month, percentage: b.percentage } });
    }
  };

  const handleRunForecast = () => {
    try {
      setForecastError(null);
      const result = calculateAllForecasts(csvData, config.benchmarks);
      dispatch({ type: 'SET_FORECASTS', payload: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while running the forecast.';
      setForecastError(message);
    }
  };

  const handleBack = () => {
    dispatch({ type: 'SET_STEP', payload: 'upload' });
  };

  const liveMerchants = csvData.filter(r => r.monthlyData.some(m => m.processingRevenue > 0 || m.saasRevenue > 0)).length;
  const notLiveMerchants = csvData.length - liveMerchants;

  return (
    <div className="space-y-6">
      <Card
        title="Monthly Revenue Benchmarks"
        subtitle="Set the percentage of annual transactional revenue that falls in each month. Used to distribute estimated annual payments revenue and to extrapolate live merchant data to annual. Must sum to 100%."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {config.benchmarks.map(b => (
              <div key={b.month} className="flex items-center gap-3">
                <label className="w-24 text-sm font-medium text-gray-700 shrink-0">
                  {b.monthName}
                </label>
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={b.percentage || ''}
                    onChange={(e) => handleBenchmarkChange(b.month, e.target.value)}
                    onBlur={(e) => handleBenchmarkBlur(b.month, e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sum indicator */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
            config.benchmarksSumValid
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {config.benchmarksSumValid ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                config.benchmarksSumValid ? 'text-green-800' : 'text-red-800'
              }`}>
                Total: {formatPercent(benchmarkSum)}
                {!config.benchmarksSumValid && ' (must equal 100%)'}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetBenchmarks} icon={<RotateCcw className="w-3.5 h-3.5" />}>
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Card>

      {/* Data Summary */}
      <Card
        title="Data Summary"
        subtitle={`${csvData.length} merchant${csvData.length !== 1 ? 's' : ''} loaded from CSV`}
      >
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Live merchants:</span>{' '}
            <span className="font-medium">{liveMerchants}</span>
          </div>
          <div>
            <span className="text-gray-500">Not yet live:</span>{' '}
            <span className="font-medium">{notLiveMerchants}</span>
          </div>
        </div>
      </Card>

      {/* Forecast Error */}
      {forecastError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="text-sm text-red-800">{forecastError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back to Upload
        </Button>
        <Button
          onClick={handleRunForecast}
          disabled={!config.benchmarksSumValid}
          size="lg"
          icon={<Calculator className="w-5 h-5" />}
        >
          Run Forecast
        </Button>
      </div>
    </div>
  );
}
