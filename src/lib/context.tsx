'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import {
  AppState,
  AppAction,
  ForecastConfig,
  Customer,
  MonthlyDataEntry,
} from './types';
import { DEFAULT_BENCHMARKS } from './constants';

const STORAGE_KEY = 'arr-forecast-customers';
const IMPORT_HISTORY_STORAGE_KEY = 'arr-forecast-import-history';

const initialConfig: ForecastConfig = {
  benchmarks: DEFAULT_BENCHMARKS.map(b => ({ ...b })),
  benchmarksSumValid: true,
};

const initialState: AppState = {
  currentStep: 'upload',
  csvData: [],
  csvErrors: [],
  config: initialConfig,
  forecasts: [],
  summary: null,
  customers: [],
  importHistory: [],
};

function checkBenchmarkSum(benchmarks: { percentage: number }[]): boolean {
  const sum = benchmarks.reduce((s, b) => s + b.percentage, 0);
  return Math.abs(sum - 100) < 0.05;
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CSV_DATA': {
      const { data, errors } = action.payload;
      return {
        ...state,
        csvData: data,
        csvErrors: errors,
        // Stay on upload step so user can review the preview table
        // (new vs existing customers, data summary) before continuing
      };
    }

    case 'UPDATE_BENCHMARK': {
      const newBenchmarks = state.config.benchmarks.map(b =>
        b.month === action.payload.month
          ? { ...b, percentage: action.payload.percentage }
          : b
      );
      return {
        ...state,
        config: {
          ...state.config,
          benchmarks: newBenchmarks,
          benchmarksSumValid: checkBenchmarkSum(newBenchmarks),
        },
      };
    }

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_FORECASTS':
      return {
        ...state,
        forecasts: action.payload.forecasts,
        summary: action.payload.summary,
        currentStep: 'results',
      };

    case 'RESET':
      return {
        ...initialState,
        customers: state.customers,
        importHistory: state.importHistory,
        config: {
          benchmarks: DEFAULT_BENCHMARKS.map(b => ({ ...b })),
          benchmarksSumValid: true,
        },
      };

    // ── Customer actions ──────────────────────────────────────────────

    case 'ADD_CUSTOMER': {
      const existing = state.customers.find(
        c => c.name.toLowerCase() === action.payload.name.toLowerCase()
      );
      if (existing) {
        return {
          ...state,
          customers: state.customers.map(c =>
            c.id === existing.id
              ? { ...c, ...action.payload, id: existing.id, createdAt: existing.createdAt }
              : c
          ),
        };
      }
      return { ...state, customers: [...state.customers, action.payload] };
    }

    case 'ADD_CUSTOMERS': {
      const newCustomers = [...state.customers];
      const originalLength = newCustomers.length;
      const usedIndices = new Set<number>();
      for (const customer of action.payload) {
        // Only match against pre-existing customers (not entries added in this batch)
        // and prevent the same existing customer from being matched twice
        const existingIdx = newCustomers.findIndex(
          (c, idx) => idx < originalLength && !usedIndices.has(idx) && c.name.toLowerCase() === customer.name.toLowerCase()
        );
        if (existingIdx >= 0) {
          usedIndices.add(existingIdx);
          newCustomers[existingIdx] = {
            ...newCustomers[existingIdx],
            ...customer,
            id: newCustomers[existingIdx].id,
            createdAt: newCustomers[existingIdx].createdAt,
          };
        } else {
          newCustomers.push(customer);
        }
      }
      return { ...state, customers: newCustomers };
    }

    case 'REMOVE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.filter(c => c.id !== action.payload),
      };

    case 'UPDATE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload.updates } : c
        ),
      };

    case 'UPDATE_MONTHLY_DATA': {
      const { customerId, month, data } = action.payload;
      return {
        ...state,
        customers: state.customers.map(c => {
          if (c.id !== customerId) return c;
          const existing: MonthlyDataEntry = c.monthlyData[month] ?? {
            paymentsRevenue: 0,
            saasRevenue: 0,
            isOverride: false,
          };
          return {
            ...c,
            monthlyData: {
              ...c.monthlyData,
              [month]: { ...existing, ...data, isOverride: true },
            },
          };
        }),
      };
    }

    case 'LOAD_CUSTOMERS':
      return { ...state, customers: action.payload };

    // ── Import History actions ───────────────────────────────────────────

    case 'ADD_IMPORT_RECORD':
      return {
        ...state,
        importHistory: [...state.importHistory, action.payload],
      };

    case 'UNDO_IMPORT': {
      const record = state.importHistory.find(r => r.id === action.payload);
      if (!record) return state;

      // Remove newly-created customers
      let updatedCustomers = state.customers.filter(
        c => !record.newCustomerIds.includes(c.id)
      );

      // Restore pre-import snapshots of updated customers
      const snapshotMap = new Map(record.updatedCustomerSnapshots.map(s => [s.id, s]));
      updatedCustomers = updatedCustomers.map(c =>
        snapshotMap.has(c.id) ? snapshotMap.get(c.id)! : c
      );

      return {
        ...state,
        customers: updatedCustomers,
        importHistory: state.importHistory.filter(r => r.id !== action.payload),
      };
    }

    case 'LOAD_IMPORT_HISTORY':
      return { ...state, importHistory: action.payload };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const hydrated = useRef(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const customers = JSON.parse(stored) as Customer[];
        dispatch({ type: 'LOAD_CUSTOMERS', payload: customers });
      }
    } catch { /* ignore parse errors */ }
    try {
      const storedHistory = localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);
      if (storedHistory) {
        dispatch({ type: 'LOAD_IMPORT_HISTORY', payload: JSON.parse(storedHistory) });
      }
    } catch { /* ignore parse errors */ }
    hydrated.current = true;
  }, []);

  // Persist customers to localStorage on change
  useEffect(() => {
    if (hydrated.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customers));
    }
  }, [state.customers]);

  // Persist import history to localStorage on change
  useEffect(() => {
    if (hydrated.current) {
      localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(state.importHistory));
    }
  }, [state.importHistory]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}
