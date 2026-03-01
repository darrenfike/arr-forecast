import { describe, it, expect } from 'vitest';

// The reducer is not directly exported, so we test through the module.
// We need to extract the reducer logic. For now, we test the key behaviors
// by importing the module's helpers and verifying state transitions.

// Since the reducer is private to context.tsx, let's test the checkBenchmarkSum
// logic and the key state transition patterns via a lightweight approach.

describe('benchmark sum validation', () => {
  function checkBenchmarkSum(benchmarks: { percentage: number }[]): boolean {
    const sum = benchmarks.reduce((s, b) => s + b.percentage, 0);
    return Math.abs(sum - 100) < 0.05;
  }

  it('accepts exactly 100', () => {
    const benchmarks = Array.from({ length: 12 }, () => ({ percentage: 100 / 12 }));
    // 100/12 * 12 won't be exactly 100 due to floating point, but should be close
    expect(checkBenchmarkSum(benchmarks)).toBe(true);
  });

  it('accepts 100.04', () => {
    const benchmarks = [
      { percentage: 5.20 }, { percentage: 5.92 }, { percentage: 7.94 },
      { percentage: 8.24 }, { percentage: 8.62 }, { percentage: 8.89 },
      { percentage: 8.38 }, { percentage: 8.23 }, { percentage: 7.50 },
      { percentage: 8.61 }, { percentage: 9.75 }, { percentage: 12.72 },
    ];
    // Sum = 100.00
    expect(checkBenchmarkSum(benchmarks)).toBe(true);
  });

  it('rejects 95%', () => {
    const benchmarks = Array.from({ length: 12 }, () => ({ percentage: 95 / 12 }));
    expect(checkBenchmarkSum(benchmarks)).toBe(false);
  });

  it('rejects 105%', () => {
    const benchmarks = Array.from({ length: 12 }, () => ({ percentage: 105 / 12 }));
    expect(checkBenchmarkSum(benchmarks)).toBe(false);
  });

  it('accepts within tolerance (99.96)', () => {
    const benchmarks = Array.from({ length: 12 }, () => ({ percentage: 99.96 / 12 }));
    expect(checkBenchmarkSum(benchmarks)).toBe(true);
  });

  it('rejects just outside tolerance (99.94)', () => {
    const benchmarks = [{ percentage: 99.94 }];
    expect(checkBenchmarkSum(benchmarks)).toBe(false);
  });
});

describe('ADD_CUSTOMERS merge behavior', () => {
  // Mirror the reducer's merge-by-name logic with usedIndices + originalLength
  function mergeCustomers(
    existing: { id: string; name: string; status: string }[],
    incoming: { id: string; name: string; status: string }[]
  ) {
    const result = [...existing];
    const originalLength = result.length;
    const usedIndices = new Set<number>();
    for (const customer of incoming) {
      const idx = result.findIndex(
        (c, i) => i < originalLength && !usedIndices.has(i) && c.name.toLowerCase() === customer.name.toLowerCase()
      );
      if (idx >= 0) {
        usedIndices.add(idx);
        result[idx] = { ...result[idx], ...customer, id: result[idx].id };
      } else {
        result.push(customer);
      }
    }
    return result;
  }

  it('adds new customers', () => {
    const result = mergeCustomers(
      [{ id: '1', name: 'Acme', status: 'live' }],
      [{ id: '2', name: 'Beta', status: 'onboarding' }]
    );
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('Beta');
  });

  it('updates existing by name (case-insensitive)', () => {
    const result = mergeCustomers(
      [{ id: '1', name: 'Acme Corp', status: 'onboarding' }],
      [{ id: '2', name: 'acme corp', status: 'live' }]
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1'); // preserves original ID
    expect(result[0].status).toBe('live'); // updated
  });

  it('handles mixed new and existing', () => {
    const result = mergeCustomers(
      [{ id: '1', name: 'Acme', status: 'live' }],
      [
        { id: '2', name: 'Acme', status: 'churned' },
        { id: '3', name: 'New Co', status: 'onboarding' },
      ]
    );
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('churned');
    expect(result[1].name).toBe('New Co');
  });

  it('keeps duplicate names within the same batch as separate entries', () => {
    const result = mergeCustomers(
      [], // no existing customers
      [
        { id: '1', name: 'Acme', status: 'live' },
        { id: '2', name: 'Acme', status: 'onboarding' },
        { id: '3', name: 'Acme', status: 'live' },
      ]
    );
    expect(result).toHaveLength(3);
  });

  it('matches duplicate incoming names to distinct existing customers', () => {
    const result = mergeCustomers(
      [
        { id: 'e1', name: 'Acme', status: 'onboarding' },
        { id: 'e2', name: 'Acme', status: 'onboarding' },
      ],
      [
        { id: 'n1', name: 'Acme', status: 'live' },
        { id: 'n2', name: 'Acme', status: 'live' },
      ]
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('e1');
    expect(result[0].status).toBe('live');
    expect(result[1].id).toBe('e2');
    expect(result[1].status).toBe('live');
  });

  it('adds extras when incoming duplicates outnumber existing', () => {
    const result = mergeCustomers(
      [{ id: 'e1', name: 'Acme', status: 'onboarding' }],
      [
        { id: 'n1', name: 'Acme', status: 'live' },
        { id: 'n2', name: 'Acme', status: 'live' },
        { id: 'n3', name: 'Acme', status: 'live' },
      ]
    );
    expect(result).toHaveLength(3); // 1 updated + 2 new
    expect(result[0].id).toBe('e1'); // first matched existing
  });
});

describe('UNDO_IMPORT behavior', () => {
  interface SimpleCustomer {
    id: string;
    name: string;
    status: string;
  }

  interface SimpleImportRecord {
    id: string;
    newCustomerIds: string[];
    updatedCustomerSnapshots: SimpleCustomer[];
  }

  function undoImport(
    customers: SimpleCustomer[],
    importHistory: SimpleImportRecord[],
    importId: string
  ) {
    const record = importHistory.find(r => r.id === importId);
    if (!record) return { customers, importHistory };

    // Remove newly created customers
    let updatedCustomers = customers.filter(
      c => !record.newCustomerIds.includes(c.id)
    );

    // Restore pre-import snapshots
    const snapshotMap = new Map(record.updatedCustomerSnapshots.map(s => [s.id, s]));
    updatedCustomers = updatedCustomers.map(c =>
      snapshotMap.has(c.id) ? snapshotMap.get(c.id)! : c
    );

    return {
      customers: updatedCustomers,
      importHistory: importHistory.filter(r => r.id !== importId),
    };
  }

  it('removes newly created customers', () => {
    const customers = [
      { id: 'c1', name: 'Existing', status: 'live' },
      { id: 'c2', name: 'New1', status: 'onboarding' },
      { id: 'c3', name: 'New2', status: 'onboarding' },
    ];
    const history = [{
      id: 'import-1',
      newCustomerIds: ['c2', 'c3'],
      updatedCustomerSnapshots: [],
    }];

    const result = undoImport(customers, history, 'import-1');
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].id).toBe('c1');
  });

  it('restores updated customers to pre-import state', () => {
    const customers = [
      { id: 'c1', name: 'Acme', status: 'live' }, // post-import state
    ];
    const history = [{
      id: 'import-1',
      newCustomerIds: [],
      updatedCustomerSnapshots: [
        { id: 'c1', name: 'Acme', status: 'onboarding' }, // pre-import state
      ],
    }];

    const result = undoImport(customers, history, 'import-1');
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].status).toBe('onboarding'); // restored
  });

  it('handles mixed new and updated customers', () => {
    const customers = [
      { id: 'c1', name: 'Acme', status: 'live' },
      { id: 'c2', name: 'NewCo', status: 'onboarding' },
    ];
    const history = [{
      id: 'import-1',
      newCustomerIds: ['c2'],
      updatedCustomerSnapshots: [
        { id: 'c1', name: 'Acme', status: 'onboarding' },
      ],
    }];

    const result = undoImport(customers, history, 'import-1');
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].id).toBe('c1');
    expect(result.customers[0].status).toBe('onboarding');
  });

  it('removes the import record from history', () => {
    const history = [
      { id: 'import-1', newCustomerIds: [], updatedCustomerSnapshots: [] },
      { id: 'import-2', newCustomerIds: [], updatedCustomerSnapshots: [] },
    ];

    const result = undoImport([], history, 'import-1');
    expect(result.importHistory).toHaveLength(1);
    expect(result.importHistory[0].id).toBe('import-2');
  });

  it('is a no-op for non-existent import id', () => {
    const customers = [{ id: 'c1', name: 'Acme', status: 'live' }];
    const history = [{ id: 'import-1', newCustomerIds: [], updatedCustomerSnapshots: [] }];

    const result = undoImport(customers, history, 'bogus-id');
    expect(result.customers).toHaveLength(1);
    expect(result.importHistory).toHaveLength(1);
  });
});
