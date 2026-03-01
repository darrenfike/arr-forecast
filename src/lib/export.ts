import { MerchantForecast, ForecastSummary } from './types';
import { formatDate } from './formatters';

/**
 * Export forecast results to a CSV file and trigger download.
 */
export function exportForecastsToCSV(
  forecasts: MerchantForecast[],
  summary: ForecastSummary
): void {
  const headers = [
    'Merchant Name',
    'Onboard Date',
    'Status',
    'Monthly SaaS Fee',
    'Est. Annual Payments Revenue',
    'Partial Month',
    'Active Days / Total Days',
    'Forecasted Annual Transactional',
    'Annual SaaS Revenue',
    'Total Forecasted ARR',
  ];

  const rows = forecasts.map(f => [
    f.merchantName,
    formatDate(f.onboardDate),
    f.isLive ? 'Live' : 'Not Live',
    f.monthlySaasFee.toFixed(2),
    f.estimatedAnnualPaymentsRevenue.toFixed(2),
    f.isPartialMonth ? 'Yes' : 'No',
    f.isPartialMonth ? `${f.activeDays}/${f.daysInOnboardMonth}` : '',
    f.forecastedAnnualTransactional.toFixed(2),
    f.annualSaasRevenue.toFixed(2),
    f.totalForecastedARR.toFixed(2),
  ]);

  // Add summary row
  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['Total Merchants', summary.merchantCount.toString()]);
  rows.push(['Live Merchants', summary.liveMerchantCount.toString()]);
  rows.push(['Not Yet Live', summary.notLiveMerchantCount.toString()]);
  rows.push(['Total Forecasted Transactional', summary.totalForecastedTransactional.toFixed(2)]);
  rows.push(['Total Annual SaaS', summary.totalAnnualSaas.toFixed(2)]);
  rows.push(['Total ARR', summary.totalARR.toFixed(2)]);
  rows.push(['Average ARR per Merchant', summary.averageARRPerMerchant.toFixed(2)]);

  // Build CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      (row as (string | number)[]).map(cell => {
        const str = cell?.toString() ?? '';
        // Quote if contains comma, newline, or quote
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `arr_forecast_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
