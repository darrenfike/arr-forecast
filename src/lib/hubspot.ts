import { HubSpotCompany } from './types';

export async function fetchHubSpotCompanies(): Promise<HubSpotCompany[]> {
  const res = await fetch('/api/hubspot/companies');
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch HubSpot companies');
  }

  return data.companies;
}
