import { NextRequest, NextResponse } from 'next/server';
import { isRemoteDSCEnabled, remoteDscGet } from '@/lib/dsc/remote-dsc';

export async function GET(request: NextRequest) {
  try {
    if (isRemoteDSCEnabled()) {
      const remoteResponse = await remoteDscGet('/api/dsc/status');
      const data = await remoteResponse.json();
      return NextResponse.json(data, { status: remoteResponse.status });
    }

    // @ts-ignore - Native module, server-only
    const dscService = (await import('../../../../lib/dsc/dsc-service')).default;
    const status = await dscService.checkStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check DSC status', details: error.message },
      { status: 500 }
    );
  }
}

