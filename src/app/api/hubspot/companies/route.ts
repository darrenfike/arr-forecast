import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Simple in-memory cache to avoid hammering HubSpot on rapid requests
// (e.g. React StrictMode double-mount in development)
let cachedResponse: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'HubSpot is not configured. Set HUBSPOT_ACCESS_TOKEN in .env.local.' },
      { status: 500 }
    );
  }

  // Return cached response if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse.data);
  }

  try {
    // Step 1: Search for deals in "closedwon" stage
    const dealsResponse = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'dealstage',
            operator: 'EQ',
            value: 'closedwon',
          }],
        }],
        properties: ['dealname'],
        limit: 100,
      }),
    });

    if (!dealsResponse.ok) {
      const err = await dealsResponse.text();
      return NextResponse.json(
        { error: 'Failed to search HubSpot deals', details: err },
        { status: 502 }
      );
    }

    const dealsData = await dealsResponse.json();
    const dealIds: string[] = dealsData.results.map((d: { id: string }) => d.id);

    if (dealIds.length === 0) {
      return NextResponse.json({ companies: [] });
    }

    // Step 2: Get associated companies for each deal
    const companyIds = new Set<string>();

    // Process in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < dealIds.length; i += batchSize) {
      const batch = dealIds.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (dealId) => {
          const res = await fetch(
            `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/companies`,
            {
              cache: 'no-store',
              headers: { 'Authorization': `Bearer ${token}` },
            }
          );
          if (!res.ok) return [];
          const data = await res.json();
          return (data.results || []).map((r: { id: string }) => r.id);
        })
      );
      for (const ids of results) {
        for (const id of ids) companyIds.add(id);
      }
    }

    if (companyIds.size === 0) {
      return NextResponse.json({ companies: [] });
    }

    // Step 3: Batch-read company details
    const companiesResponse = await fetch('https://api.hubapi.com/crm/v3/objects/companies/batch/read', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: Array.from(companyIds).map(id => ({ id })),
        properties: ['name', 'domain'],
      }),
    });

    if (!companiesResponse.ok) {
      const errText = await companiesResponse.text();
      return NextResponse.json(
        { error: 'Failed to fetch company details from HubSpot', details: errText },
        { status: 502 }
      );
    }

    const companiesData = await companiesResponse.json();
    const companies = (companiesData.results || []).map((c: { id: string; properties: { name?: string; domain?: string } }) => ({
      id: c.id,
      name: c.properties.name || 'Unnamed Company',
      domain: c.properties.domain || undefined,
    }));

    const result = { companies };
    cachedResponse = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error connecting to HubSpot', details: String(err) },
      { status: 500 }
    );
  }
}
