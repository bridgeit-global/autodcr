import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - Native module, server-only
import dscService from '../../../../lib/dsc/dsc-service';

export async function GET(request: NextRequest) {
  try {
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

