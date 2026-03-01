// ── CSV Input ──────────────────────────────────────────────────────────

export interface MonthlyColumnData {
  processingVolume: number;
  transactionVolume: number;
  processingRevenue: number;
  saasRevenue: number;
}

export interface CSVRow {
  merchantName: string;
  onboardDate: string;                    // ISO date string (YYYY-MM-DD)
  monthlySaasFee: number;                 // For not-yet-live merchants
  estimatedAnnualPaymentsVolume: number;  // For not-yet-live merchants
  estimatedAnnualPaymentsRevenue: number; // For not-yet-live merchants
  monthlyData: MonthlyColumnData[];       // 12 entries, index 0 = January, 11 = December
}

export interface CSVValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface CSVParseResult {
  data: CSVRow[];
  errors: CSVValidationError[];
  warnings: string[];
}

// ── Configuration ──────────────────────────────────────────────────────

export interface MonthlyBenchmark {
  month: number;         // 1-12
  monthName: string;
  percentage: number;    // e.g. 5.20 (whole number, not decimal)
}

export interface ForecastConfig {
  benchmarks: MonthlyBenchmark[];
  benchmarksSumValid: boolean;
}

// ── Calculation Results ────────────────────────────────────────────────

export interface MerchantForecast {
  merchantName: string;
  onboardDate: Date;
  isLive: boolean;

  // Source data
  monthlySaasFee: number;
  estimatedAnnualPaymentsRevenue: number;

  // Proration (for the onboard month)
  isPartialMonth: boolean;
  activeDays: number;
  daysInOnboardMonth: number;

  // Annual forecasts
  forecastedAnnualTransactional: number;
  annualSaasRevenue: number;
  totalForecastedARR: number;
}

export interface ForecastSummary {
  merchantCount: number;
  liveMerchantCount: number;
  notLiveMerchantCount: number;
  totalForecastedTransactional: number;
  totalAnnualSaas: number;
  totalARR: number;
  liveARR: number;
  averageARRPerMerchant: number;
}

// ── Customers ─────────────────────────────────────────────────────────

export type CustomerStatus = 'live' | 'onboarding' | 'churned';
export type CustomerSource = 'manual' | 'hubspot' | 'csv';

export interface MonthlyDataEntry {
  paymentsRevenue: number;
  saasRevenue: number;
  isOverride: boolean;
}

export interface Customer {
  id: string;
  name: string;
  status: CustomerStatus;
  source: CustomerSource;
  hubspotCompanyId?: string;
  launchDate?: string;                              // ISO date string
  forecastedAnnualProcessingRevenue: number;
  monthlySaasRevenue: number;
  monthlyData: Record<string, MonthlyDataEntry>;    // keyed by "YYYY-MM"
  createdAt: string;
}

export interface HubSpotCompany {
  id: string;
  name: string;
  domain?: string;
}

// ── Import History ────────────────────────────────────────────────────

export interface ImportRecord {
  id: string;
  date: string;                          // ISO timestamp
  customersImported: number;
  forecastedARR: number;
  newCustomerIds: string[];              // IDs of customers created by this import (for undo)
  updatedCustomerSnapshots: Customer[];  // Pre-import state of updated customers (for undo)
}

// ── App State ──────────────────────────────────────────────────────────

export type AppStep = 'upload' | 'configure' | 'results';

export interface AppState {
  currentStep: AppStep;
  csvData: CSVRow[];
  csvErrors: CSVValidationError[];
  config: ForecastConfig;
  forecasts: MerchantForecast[];
  summary: ForecastSummary | null;
  customers: Customer[];
  importHistory: ImportRecord[];
}

export type AppAction =
  | { type: 'SET_CSV_DATA'; payload: CSVParseResult }
  | { type: 'UPDATE_BENCHMARK'; payload: { month: number; percentage: number } }
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'SET_FORECASTS'; payload: { forecasts: MerchantForecast[]; summary: ForecastSummary } }
  | { type: 'RESET' }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'ADD_CUSTOMERS'; payload: Customer[] }
  | { type: 'REMOVE_CUSTOMER'; payload: string }
  | { type: 'UPDATE_CUSTOMER'; payload: { id: string; updates: Partial<Omit<Customer, 'id'>> } }
  | { type: 'UPDATE_MONTHLY_DATA'; payload: { customerId: string; month: string; data: Partial<MonthlyDataEntry> } }
  | { type: 'LOAD_CUSTOMERS'; payload: Customer[] }
  | { type: 'ADD_IMPORT_RECORD'; payload: ImportRecord }
  | { type: 'UNDO_IMPORT'; payload: string }
  | { type: 'LOAD_IMPORT_HISTORY'; payload: ImportRecord[] };
