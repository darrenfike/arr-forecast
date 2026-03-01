'use client';

import { useState } from 'react';
import { useAppContext } from '@/lib/context';
import { CustomerStatus } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { HubSpotCompanyPicker } from './HubSpotCompanyPicker';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddCustomerModal({ isOpen, onClose }: AddCustomerModalProps) {
  const { dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'manual' | 'hubspot'>('manual');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('live');
  const [launchDate, setLaunchDate] = useState('');
  const [annualProcessing, setAnnualProcessing] = useState('');
  const [monthlySaas, setMonthlySaas] = useState('');

  const resetForm = () => {
    setName('');
    setStatus('live');
    setLaunchDate('');
    setAnnualProcessing('');
    setMonthlySaas('');
  };

  const handleManualAdd = () => {
    if (!name.trim()) return;
    dispatch({
      type: 'ADD_CUSTOMER',
      payload: {
        id: crypto.randomUUID(),
        name: name.trim(),
        status,
        source: 'manual',
        launchDate: launchDate || undefined,
        forecastedAnnualProcessingRevenue: parseFloat(annualProcessing) || 0,
        monthlySaasRevenue: parseFloat(monthlySaas) || 0,
        monthlyData: {},
        createdAt: new Date().toISOString(),
      },
    });
    resetForm();
    onClose();
  };

  const handleHubSpotSelect = (companyId: string, companyName: string) => {
    dispatch({
      type: 'ADD_CUSTOMER',
      payload: {
        id: crypto.randomUUID(),
        name: companyName,
        status: 'live',
        source: 'hubspot',
        hubspotCompanyId: companyId,
        forecastedAnnualProcessingRevenue: 0,
        monthlySaasRevenue: 0,
        monthlyData: {},
        createdAt: new Date().toISOString(),
      },
    });
  };

  const tabs = [
    { id: 'manual' as const, label: 'Manual Entry' },
    { id: 'hubspot' as const, label: 'HubSpot' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Customer" subtitle="Add a new customer manually or import from HubSpot">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as CustomerStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="live">Live</option>
              <option value="onboarding">Signed / Onboarding</option>
              <option value="churned">Churned</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Launch Date</label>
            <input
              type="date"
              value={launchDate}
              onChange={e => setLaunchDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Processing Revenue</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={annualProcessing}
                  onChange={e => setAnnualProcessing(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 pl-7 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly SaaS Revenue</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlySaas}
                  onChange={e => setMonthlySaas(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 pl-7 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleManualAdd} disabled={!name.trim()}>Add Customer</Button>
          </div>
        </div>
      )}

      {activeTab === 'hubspot' && (
        <HubSpotCompanyPicker
          onSelect={handleHubSpotSelect}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
