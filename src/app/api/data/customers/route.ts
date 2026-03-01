import { NextResponse } from 'next/server';
import { getRedis, KV_KEYS } from '@/lib/kv';
import { Customer } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const customers = await getRedis().get<Customer[]>(KV_KEYS.customers);
    return NextResponse.json({ customers: customers ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read customers', details: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const customers: Customer[] = body.customers;

    if (!Array.isArray(customers)) {
      return NextResponse.json(
        { error: 'Invalid payload: customers must be an array' },
        { status: 400 }
      );
    }

    await getRedis().set(KV_KEYS.customers, customers);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to write customers', details: String(err) },
      { status: 500 }
    );
  }
}
