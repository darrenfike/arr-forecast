'use client';

import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { AddCustomerModal } from '@/components/customers/AddCustomerModal';
import { BulkUploadModal } from '@/components/customers/BulkUploadModal';

export default function CustomersPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500">Manage your customer portfolio and revenue tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => setShowUploadModal(true)}
          >
            Bulk Upload
          </Button>
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CustomerTable />
      </Card>

      <AddCustomerModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
      <BulkUploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </main>
  );
}
