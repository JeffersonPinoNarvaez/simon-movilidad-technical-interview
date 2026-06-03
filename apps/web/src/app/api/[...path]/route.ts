import { NextRequest, NextResponse } from 'next/server';

const API_ORIGIN = (
  process.env.API_INTERNAL_URL ??
  process.env.API_URL ??
  'http://127.0.0.1:3001'
).replace(/\/$/, '');

async function proxyRequest(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join('/');
  const target = new URL(`${API_ORIGIN}/${path}`);
  target.search = req.nextUrl.search;

  const headers = new Headers(req.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}
