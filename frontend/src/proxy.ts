import { NextRequest, NextResponse } from 'next/server';

// Admin password gating is handled by in-app verification flow to ensure
// a consistent password prompt in every new tab/session.
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
