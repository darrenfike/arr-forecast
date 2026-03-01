'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useAppContext } from '@/lib/context';
import { Customer, CustomerStatus } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cleanCurrencyString, parseDateString } from '@/lib/formatters';
import { calculateProration } from '@/lib/calculations';
import { FORECAST_YEAR } from '@/lib/constants';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_ALIASES: Record<string, CustomerStatus> = {
  live: 'live',
  active: 'live',
  onboarding: 'onboarding',
  'signed / onboarding': 'onboarding',
  signed: 'onboarding',
  churned: 'churned',
  cancelled: 'churned',
  canceled: 'churned',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-]/g, ' ');
}

function matchHeader(h: string): string | null {
  const n = normalizeHeader(h);
  if (['customer name', 'customer', 'name', 'merchant', 'merchant name'].includes(n)) return 'name';
  if (['status'].includes(n)) return 'status';
  if (['launch date', 'launch_date', 'go live date', 'go_live_date', 'live date'].includes(n)) return 'launchDate';
  if (['annual processing revenue', 'annual processing', 'forecasted annual processing revenue', 'est arr', 'processing revenue'].includes(n)) return 'annualProcessing';
  if (['monthly saas revenue', 'monthly saas', 'saas revenue'].includes(n)) return 'monthlySaas';
  // Monthly columns: e.g. "Dec 2025 Payments", "Jan 2026 SaaS"
  const monthlyMatch = n.match(/^([a-z]{3})\s+(\d{4})\s+(payments?|saas)$/);
  if (monthlyMatch) {
    const [, mon, year, type] = monthlyMatch;
    const monthNum = monthNameToNum(mon);
    if (monthNum) {
      const key = `${year}-${String(monthNum).padStart(2, '0')}`;
      return `monthly:${key}:${type.startsWith('payment') ? 'payments' : 'saas'}`;
    }
  }
  return null;
}

function monthNameToNum(name: string): number | null {
  const map: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  return map[name.toLowerCase()] ?? null;
}

export function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
  const { dispatch } = useAppContext();
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<Customer[] | null>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setErrors([]);
    setPreview(null);
    setFileName('');
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setErrors([]);
    setPreview(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          setErrors(['CSV file is empty']);
          return;
        }

        const headers = Object.keys(rows[0]);
        const mapping: Record<string, string> = {};
        for (const h of headers) {
          const field = matchHeader(h);
          if (field) mapping[h] = field;
        }

        if (!Object.values(mapping).includes('name')) {
          setErrors(['Missing required column: Customer Name']);
          return;
        }

        const parseErrors: string[] = [];
        const customers: Customer[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          let name = '';
          let status: CustomerStatus = 'live';
          let launchDate: string | undefined;
          let annualProcessing = 0;
          let monthlySaas = 0;
          const monthlyData: Customer['monthlyData'] = {};

          for (const [header, field] of Object.entries(mapping)) {
            const val = (row[header] ?? '').trim();
            if (!val) continue;

            if (field === 'name') {
              name = val;
            } else if (field === 'status') {
              const s = STATUS_ALIASES[val.toLowerCase()];
              if (s) status = s;
              else parseErrors.push(`Row ${i + 2}: Unknown status "${val}", defaulting to "live"`);
            } else if (field === 'launchDate') {
              const d = parseDateString(val);
              if (d) launchDate = d;
              else parseErrors.push(`Row ${i + 2}: Could not parse date "${val}"`);
            } else if (field === 'annualProcessing') {
              annualProcessing = cleanCurrencyString(val);
            } else if (field === 'monthlySaas') {
              monthlySaas = cleanCurrencyString(val);
            } else if (field.startsWith('monthly:')) {
              const [, monthKey, type] = field.split(':');
              if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { paymentsRevenue: 0, saasRevenue: 0, isOverride: true };
              }
              if (type === 'payments') {
                monthlyData[monthKey].paymentsRevenue = cleanCurrencyString(val);
              } else {
                monthlyData[monthKey].saasRevenue = cleanCurrencyString(val);
              }
            }
          }

          if (!name) {
            parseErrors.push(`Row ${i + 2}: Missing customer name, skipping`);
            continue;
          }

          // Prorate payments revenue for the launch month to a full-month estimate
          if (launchDate) {
            const ld = new Date(launchDate + 'T00:00:00');
            const proration = calculateProration(ld);
            if (proration.isPartial) {
              const monthKey = `${proration.onboardYear}-${String(proration.onboardMonth).padStart(2, '0')}`;
              const entry = monthlyData[monthKey];
              if (entry && entry.paymentsRevenue > 0) {
                // Scale partial month to full month
                entry.paymentsRevenue = Math.round(
                  entry.paymentsRevenue * (proration.daysInMonth / proration.activeDays) * 100
                ) / 100;
              }
            }
          }

          customers.push({
            id: crypto.randomUUID(),
            name,
            status,
            source: 'csv',
            launchDate,
            forecastedAnnualProcessingRevenue: annualProcessing,
            monthlySaasRevenue: monthlySaas,
            monthlyData,
            createdAt: new Date().toISOString(),
          });
        }

        setErrors(parseErrors);
        setPreview(customers);
      },
      error: () => {
        setErrors(['Failed to parse CSV file']);
      },
    });
  };

  const handleImport = () => {
    if (preview && preview.length > 0) {
      dispatch({ type: 'ADD_CUSTOMERS', payload: preview });
      reset();
      onClose();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  };

  const handleDownloadTemplate = () => {
    const prevYear = FORECAST_YEAR - 1;
    const headers = [
      'Customer Name', 'Status', 'Launch Date',
      'Annual Processing Revenue', 'Monthly SaaS Revenue',
      `Dec ${prevYear} Payments`, `Dec ${prevYear} SaaS`,
      `Jan ${FORECAST_YEAR} Payments`, `Jan ${FORECAST_YEAR} SaaS`,
    ];
    const sample = [
      `Acme Corp,Live,${prevYear}-12-01,50000,500,4100,500,4100,500`,
      `Beta Inc,Onboarding,${FORECAST_YEAR}-01-15,30000,300,,,2460,300`,
    ];
    const csv = headers.join(',') + '\n' + sample.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Bulk Upload Customers" subtitle="Import customers from a CSV file" maxWidth="max-w-2xl">
      {!preview ? (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              {fileName || 'Drag & drop your CSV file here'}
            </p>
            <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            <input
              type="file"
              accept=".csv"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ position: 'relative' }}
            />
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download CSV template
          </button>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Errors</span>
              </div>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 ml-6">{e}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {preview.length} customer{preview.length !== 1 ? 's' : ''} ready to import
            </span>
          </div>

          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="text-sm font-medium text-amber-800">Warnings ({errors.length})</span>
              <div className="mt-1 max-h-24 overflow-y-auto">
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">{e}</p>
                ))}
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-1.5 px-3 text-xs font-medium text-gray-500">Name</th>
                  <th className="text-left py-1.5 px-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left py-1.5 px-3 text-xs font-medium text-gray-500">Launch Date</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-3 font-medium">{c.name}</td>
                    <td className="py-1.5 px-3 capitalize">{c.status}</td>
                    <td className="py-1.5 px-3 text-gray-600">{c.launchDate ?? '—'}</td>
                  </tr>
                ))}
                {preview.length > 10 && (
                  <tr>
                    <td colSpan={3} className="py-1.5 px-3 text-xs text-gray-500 text-center">
                      ...and {preview.length - 10} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={reset}>Back</Button>
            <Button onClick={handleImport}>Import {preview.length} Customer{preview.length !== 1 ? 's' : ''}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
