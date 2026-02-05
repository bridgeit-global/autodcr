import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - Native module, server-only
import dscService from '../../../../lib/dsc/dsc-service';

export async function GET(request: NextRequest) {
  try {
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

