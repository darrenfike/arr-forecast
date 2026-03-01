'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  start: string; // YYYY-MM
  end: string;   // YYYY-MM
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS = [
  { label: '2026 YTD', start: '2026-01', end: '2026-12' },
  { label: '2025', start: '2025-01', end: '2025-12' },
  { label: 'Last 6 months', start: getMonthsAgo(6), end: getCurrentMonth() },
  { label: 'Last 12 months', start: getMonthsAgo(12), end: getCurrentMonth() },
];

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatLabel = (range: DateRange) => {
    const preset = PRESETS.find(p => p.start === range.start && p.end === range.end);
    if (preset) return preset.label;
    return `${range.start} to ${range.end}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        {formatLabel(value)}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase">Presets</p>
              <div className="grid grid-cols-2 gap-1">
                {PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      onChange({ start: preset.start, end: preset.end });
                      setIsOpen(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md text-left transition-colors ${
                      value.start === preset.start && value.end === preset.end
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Custom Range</p>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={value.start}
                  onChange={e => onChange({ ...value, start: e.target.value })}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="month"
                  value={value.end}
                  onChange={e => onChange({ ...value, end: e.target.value })}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
