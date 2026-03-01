'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, Check } from 'lucide-react';
import { HubSpotCompany } from '@/lib/types';
import { useAppContext } from '@/lib/context';
import { fetchHubSpotCompanies } from '@/lib/hubspot';
import { Button } from '@/components/ui/Button';

interface HubSpotCompanyPickerProps {
  onSelect: (companyId: string, companyName: string) => void;
  onClose: () => void;
}

export function HubSpotCompanyPicker({ onSelect, onClose }: HubSpotCompanyPickerProps) {
  const { state } = useAppContext();
  const [companies, setCompanies] = useState<HubSpotCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const existingHubSpotIds = new Set(
    state.customers
      .filter(c => c.hubspotCompanyId)
      .map(c => c.hubspotCompanyId!)
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchHubSpotCompanies()
      .then(data => {
        if (!cancelled) setCompanies(data);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Failed to load HubSpot companies');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.domain && c.domain.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    for (const id of selectedIds) {
      const company = companies.find(c => c.id === id);
      if (company) {
        onSelect(company.id, company.name);
      }
    }
    setSelectedIds(new Set());
    onClose();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading companies from HubSpot...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm font-medium text-gray-900 mb-1">Unable to connect to HubSpot</p>
        <p className="text-xs text-gray-500 text-center max-w-xs mb-4">{error}</p>
        <p className="text-xs text-gray-400">Make sure HUBSPOT_ACCESS_TOKEN is set in your .env.local file.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {search ? 'No companies match your search' : 'No Closed Won companies found'}
          </div>
        ) : (
          filtered.map(company => {
            const alreadyAdded = existingHubSpotIds.has(company.id);
            const isSelected = selectedIds.has(company.id);

            return (
              <button
                key={company.id}
                onClick={() => !alreadyAdded && toggleSelect(company.id)}
                disabled={alreadyAdded}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                  alreadyAdded
                    ? 'bg-gray-50 text-gray-400 cursor-default'
                    : isSelected
                      ? 'bg-blue-50 text-blue-900'
                      : 'hover:bg-gray-50 text-gray-900'
                }`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                  alreadyAdded
                    ? 'bg-gray-200 border-gray-300'
                    : isSelected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300'
                }`}>
                  {(alreadyAdded || isSelected) && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{company.name}</div>
                  {company.domain && (
                    <div className="text-xs text-gray-500 truncate">{company.domain}</div>
                  )}
                </div>
                {alreadyAdded && (
                  <span className="text-xs text-gray-400 shrink-0">Already added</span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-500">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filtered.length} companies`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selectedIds.size === 0}>
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
