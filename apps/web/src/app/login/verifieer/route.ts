// Het inwisselpunt van de magic link. Een GET, want een mailclient klikt.
import { NextResponse } from 'next/server';
import { wisselTokenIn } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const email = token ? await wisselTokenIn(token) : null;

  // Doorsturen in plaats van renderen, zodat het token uit de adresbalk en uit
  // de browsergeschiedenis verdwijnt zodra hij gebruikt is.
  return NextResponse.redirect(new URL(email ? '/' : '/login?status=ongeldig', request.url));
}
