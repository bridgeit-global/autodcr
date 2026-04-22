import { NextRequest, NextResponse } from 'next/server';

const normalizeBaseUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export async function GET(request: NextRequest) {
  try {
    const remoteBaseUrl = normalizeBaseUrl(process.env.DSC_SERVICE_URL);
    if (!remoteBaseUrl) {
      return NextResponse.json(
        { error: 'DSC_SERVICE_URL is not configured' },
        { status: 500 }
      );
    }

    const remoteUrlParam = request.nextUrl.searchParams.get('url');
    if (!remoteUrlParam) {
      return NextResponse.json(
        { error: 'Missing file URL' },
        { status: 400 }
      );
    }

    let decodedUrl: URL;
    try {
      decodedUrl = new URL(remoteUrlParam);
    } catch {
      return NextResponse.json(
        { error: 'Invalid file URL' },
        { status: 400 }
      );
    }

    // Only allow proxying files from configured DSC host uploads directory.
    if (
      !decodedUrl.href.startsWith(remoteBaseUrl) ||
      !decodedUrl.pathname.startsWith('/uploads/')
    ) {
      return NextResponse.json(
        { error: 'File URL is not allowed' },
        { status: 403 }
      );
    }

    const headers: HeadersInit = {};
    if (process.env.DSC_SERVICE_API_KEY) {
      headers['x-api-key'] = process.env.DSC_SERVICE_API_KEY;
    }

    const remoteResponse = await fetch(decodedUrl.href, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!remoteResponse.ok) {
      const text = await remoteResponse.text().catch(() => '');
      return NextResponse.json(
        { error: 'Failed to fetch remote signed PDF', details: text || remoteResponse.statusText },
        { status: remoteResponse.status }
      );
    }

    const bytes = await remoteResponse.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': remoteResponse.headers.get('content-type') || 'application/pdf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to proxy signed PDF', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
