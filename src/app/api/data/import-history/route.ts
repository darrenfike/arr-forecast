import { NextResponse } from 'next/server';
import { getRedis, KV_KEYS } from '@/lib/kv';
import { ImportRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const history = await getRedis().get<ImportRecord[]>(KV_KEYS.importHistory);
    return NextResponse.json({ importHistory: history ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read import history', details: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const importHistory: ImportRecord[] = body.importHistory;

    if (!Array.isArray(importHistory)) {
      return NextResponse.json(
        { error: 'Invalid payload: importHistory must be an array' },
        { status: 400 }
      );
    }

    await getRedis().set(KV_KEYS.importHistory, importHistory);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to write import history', details: String(err) },
      { status: 500 }
    );
  }
}
