import { NextResponse } from 'next/server';
import crypto from 'crypto';

const textToBuffer = (value: string) => Buffer.from(value, 'utf8');

export async function POST(request: Request) {
  try {
    const adminPassword = process.env.ADMIN_ACCESS_PASSWORD || '';
    if (!adminPassword) {
      return NextResponse.json({ message: 'Admin password is not configured on server.' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const providedPassword = String(body?.password || '');

    const expected = textToBuffer(adminPassword);
    const provided = textToBuffer(providedPassword);

    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return NextResponse.json({ message: 'Invalid admin password' }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Unable to verify admin password' }, { status: 500 });
  }
}
