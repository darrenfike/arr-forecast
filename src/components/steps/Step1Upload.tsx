'use client';

import { useState } from 'react';
import { Download, AlertCircle, CheckCircle, ArrowRight, UserPlus, UserCheck } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { parseCSVFile, generateCSVTemplate } from '@/lib/csv-parser';
import { CSVRow, CSVValidationError, Customer, ImportRecord, MonthlyDataEntry } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { formatCurrency } from '@/lib/formatters';
import { getCustomerARR } from '@/lib/calculations';
import { FORECAST_YEAR } from '@/lib/constants';

/**
 * Convert a CSVRow into a Customer record, populating monthly data
 * from any actual monthly values in the CSV.
 */
function csvRowToCustomer(row: CSVRow): Customer {
  // Live status is based on onboard date: past or today = live, future = onboarding
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isLive = row.onboardDate
    ? new Date(row.onboardDate + 'T00:00:00') <= today
    : false;

  // Build monthlyData from the CSV's 12-month array
  const monthlyData: Record<string, MonthlyDataEntry> = {};
  for (let m = 0; m < 12; m++) {
    const md = row.monthlyData[m];
    if (md.processingRevenue > 0 || md.saasRevenue > 0) {
      const key = `${FORECAST_YEAR}-${String(m + 1).padStart(2, '0')}`;
      monthlyData[key] = {
        paymentsRevenue: md.processingRevenue,
        saasRevenue: md.saasRevenue,
        isOverride: false,
      };
    }
  }

  return {
    id: crypto.randomUUID(),
    name: row.merchantName,
    status: isLive ? 'live' : 'onboarding',
    source: 'csv',
    launchDate: row.onboardDate || undefined,
    forecastedAnnualProcessingRevenue: row.estimatedAnnualPaymentsRevenue,
    monthlySaasRevenue: row.monthlySaasFee,
    monthlyData,
    createdAt: new Date().toISOString(),
  };
}

export function Step1Upload() {
  const { state, dispatch } = useAppContext();
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<CSVValidationError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerStats, setCustomerStats] = useState<{ created: number; updated: number } | null>(null);
  // Track which merchants were new at upload time (before they get created)
  const [newMerchantNames, setNewMerchantNames] = useState<Set<string>>(new Set());

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    setCustomerStats(null);
    setNewMerchantNames(new Set());

    const result = await parseCSVFile(file);
    setPreviewData(result.data);
    setErrors(result.errors);
    setWarnings(result.warnings);

    if (result.errors.length === 0 && result.data.length > 0) {
      dispatch({ type: 'SET_CSV_DATA', payload: result });

      // Determine new vs existing BEFORE creating customers
      const existingNames = new Set(state.customers.map(c => c.name.toLowerCase()));
      const newNames = new Set(
        result.data
          .filter(row => !existingNames.has(row.merchantName.toLowerCase()))
          .map(row => row.merchantName.toLowerCase())
      );
      setNewMerchantNames(newNames);

      const newCount = newNames.size;
      const updatedCount = result.data.length - newCount;

      // Auto-create/update customers from CSV rows
      const customers = result.data.map(csvRowToCustomer);

      // Build import record (capture pre-import snapshots for undo)
      const newCustomerIds: string[] = [];
      const updatedCustomerSnapshots: Customer[] = [];
      const usedForRecord = new Set<string>();
      for (const customer of customers) {
        const existing = state.customers.find(
          c => !usedForRecord.has(c.id) && c.name.toLowerCase() === customer.name.toLowerCase()
        );
        if (existing) {
          usedForRecord.add(existing.id);
          updatedCustomerSnapshots.push({ ...existing, monthlyData: { ...existing.monthlyData } });
        } else {
          newCustomerIds.push(customer.id);
        }
      }

      dispatch({ type: 'ADD_CUSTOMERS', payload: customers });

      const forecastedARR = customers.reduce((sum, c) => sum + getCustomerARR(c), 0);
      const importRecord: ImportRecord = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        customersImported: customers.length,
        forecastedARR,
        newCustomerIds,
        updatedCustomerSnapshots,
      };
      dispatch({ type: 'ADD_IMPORT_RECORD', payload: importRecord });

      setCustomerStats({ created: newCount, updated: updatedCount });
    }

    setIsLoading(false);
  };

  const handleClear = () => {
    setFileName('');
    setPreviewData([]);
    setErrors([]);
    setWarnings([]);
    setCustomerStats(null);
  };

  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'arr_forecast_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_STEP', payload: 'configure' });
  };

  const isValid = errors.length === 0 && previewData.length > 0;

  const countMonthsWithData = (row: CSVRow): number => {
    return row.monthlyData.filter(m => m.processingRevenue > 0 || m.saasRevenue > 0).length;
  };

  return (
    <div className="space-y-6">
      <Card
        title="Upload Merchant Data"
        subtitle="Upload a CSV file with merchant payout data to begin forecasting."
      >
        <div className="space-y-4">
          <FileUpload
            onFileSelect={handleFileSelect}
            fileName={fileName}
            onClear={handleClear}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadTemplate}
              icon={<Download className="w-4 h-4" />}
            >
              Download CSV Template
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">Parsing CSV file...</p>
          </div>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Card title="Validation Errors" className="border-red-200">
          <div className="space-y-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-red-700">
                  {err.row > 0 && <span className="font-medium">Row {err.row}: </span>}
                  {err.message}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card>
          <div className="space-y-2">
            {warnings.map((warn, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-amber-700">{warn}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customer Creation Summary */}
      {customerStats && (
        <Card>
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-gray-900">Customers synced from CSV</p>
              <div className="mt-1 space-y-1 text-gray-600">
                {customerStats.created > 0 && (
                  <p>{customerStats.created} new customer{customerStats.created !== 1 ? 's' : ''} created</p>
                )}
                {customerStats.updated > 0 && (
                  <p>{customerStats.updated} existing customer{customerStats.updated !== 1 ? 's' : ''} updated</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Table */}
      {previewData.length > 0 && (
        <Card
          title={`Preview (${previewData.length} merchant${previewData.length !== 1 ? 's' : ''})`}
          subtitle="Showing parsed data from your CSV file."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Merchant</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Onboard Date</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-500">Monthly SaaS</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-500">Est. Annual Rev</th>
                  <th className="text-center py-2 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-center py-2 px-4 font-medium text-gray-500">Customer</th>
                  <th className="text-center py-2 px-4 font-medium text-gray-500">Months w/ Data</th>
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 15).map((row, i) => {
                  const monthsWithData = countMonthsWithData(row);
                  const todayForPreview = new Date();
                  todayForPreview.setHours(0, 0, 0, 0);
                  const isLive = row.onboardDate
                    ? new Date(row.onboardDate + 'T00:00:00') <= todayForPreview
                    : false;
                  const isNew = newMerchantNames.has(row.merchantName.toLowerCase());
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-900">{row.merchantName}</td>
                      <td className="py-2 px-4 text-gray-700">{row.onboardDate || '—'}</td>
                      <td className="py-2 px-4 text-right text-gray-700">
                        {row.monthlySaasFee > 0 ? formatCurrency(row.monthlySaasFee) : '—'}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-700">
                        {row.estimatedAnnualPaymentsRevenue > 0 ? formatCurrency(row.estimatedAnnualPaymentsRevenue) : '—'}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isLive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isLive ? 'Live' : 'Not Live'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isNew ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isNew ? (
                            <><UserPlus className="w-3 h-3" /> New</>
                          ) : (
                            <><UserCheck className="w-3 h-3" /> Existing</>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center text-gray-700">
                        {monthsWithData > 0 ? `${monthsWithData}/12` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {previewData.length > 15 && (
              <p className="text-sm text-gray-500 mt-2">
                ... and {previewData.length - 15} more merchants
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Success + Continue */}
      {isValid && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-6 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {previewData.length} merchant{previewData.length !== 1 ? 's' : ''} ready for forecasting
            </span>
          </div>
          <Button onClick={handleContinue} icon={<ArrowRight className="w-4 h-4" />}>
            Continue to Configuration
          </Button>
        </div>
      )}
    </div>
  );
}
