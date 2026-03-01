'use client';

import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { Card } from '@/components/ui/Card';
import { formatCurrencyCompact } from '@/lib/formatters';

export function ImportHistoryTable() {
  const { state, dispatch } = useAppContext();
  const { importHistory } = state;
  const [undoingId, setUndoingId] = useState<string | null>(null);

  if (importHistory.length === 0) return null;

  const handleUndo = (id: string) => {
    setUndoingId(id);
    setTimeout(() => {
      dispatch({ type: 'UNDO_IMPORT', payload: id });
      setUndoingId(null);
    }, 300);
  };

  const formatImportDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Card
      title="Import History"
      subtitle={`${importHistory.length} import${importHistory.length !== 1 ? 's' : ''} recorded`}
    >
      <div className="overflow-x-auto -mx-6">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 px-6 text-left font-medium text-gray-500">Date</th>
              <th className="py-2 px-6 text-right font-medium text-gray-500">Customers Imported</th>
              <th className="py-2 px-6 text-right font-medium text-gray-500">Forecasted ARR</th>
              <th className="py-2 px-6 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {[...importHistory].reverse().map(record => (
              <tr
                key={record.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-opacity ${
                  undoingId === record.id ? 'opacity-50' : ''
                }`}
              >
                <td className="py-3 px-6 text-gray-900">
                  {formatImportDate(record.date)}
                </td>
                <td className="py-3 px-6 text-right text-gray-700 font-mono">
                  {record.customersImported}
                </td>
                <td className="py-3 px-6 text-right font-semibold text-gray-900 font-mono">
                  {formatCurrencyCompact(record.forecastedARR)}
                </td>
                <td className="py-3 px-6 text-right">
                  <button
                    onClick={() => handleUndo(record.id)}
                    disabled={undoingId !== null}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-gray-500 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Undo this import"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
