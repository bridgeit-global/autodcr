import { NextRequest, NextResponse } from 'next/server';
import { isRemoteDSCEnabled, remoteDscGet } from '@/lib/dsc/remote-dsc';

export async function GET(request: NextRequest) {
  try {
    if (isRemoteDSCEnabled()) {
      const remoteResponse = await remoteDscGet('/api/dsc/certificates');
      const data = await remoteResponse.json();
      return NextResponse.json(data, { status: remoteResponse.status });
    }

    // @ts-ignore - Native module, server-only
    const dscService = (await import('../../../../lib/dsc/dsc-service')).default;
    if (!dscService.isInitialized) {
      const initResult = await dscService.initialize();
      if (!initResult.success) {
        return NextResponse.json(
          { error: 'DSC initialization failed', details: initResult.error },
          { status: 500 }
        );
      }
    }

    const result = await dscService.findAllCertificates();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('List certificates error:', error);
    return NextResponse.json(
      { error: 'Failed to list certificates', details: error.message },
      { status: 500 }
    );
  }
}

