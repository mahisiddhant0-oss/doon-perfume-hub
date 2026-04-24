import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USERNAME = process.env.ADMIN_ACCESS_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_ACCESS_PASSWORD || '';

const unauthorizedResponse = () =>
  new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
    },
  });

export function proxy(request: NextRequest) {
  if (!ADMIN_PASSWORD) {
    return new NextResponse('Admin password is not configured on server.', { status: 503 });
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  try {
    const base64Credentials = authHeader.split(' ')[1] || '';
    const credentials = atob(base64Credentials);
    const separatorIndex = credentials.indexOf(':');

    if (separatorIndex === -1) {
      return unauthorizedResponse();
    }

    const username = credentials.slice(0, separatorIndex);
    const password = credentials.slice(separatorIndex + 1);

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return unauthorizedResponse();
    }

    return NextResponse.next();
  } catch {
    return unauthorizedResponse();
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
