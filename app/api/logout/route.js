import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  cookies().set(nomeCookie(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
