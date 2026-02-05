import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// @ts-ignore - Native modules, server-only
import dscService from '../../../../lib/dsc/dsc-service';
// @ts-ignore - Native modules, server-only
import pdfSignerPKCS11 from '../../../../lib/dsc/pdf-signer-pkcs11';

export async function POST(request: NextRequest) {
  try {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const pin = (formData.get('pin') as string) || '';
    const certificateIndex = parseInt((formData.get('certificateIndex') as string) || '0') || 0;
    const slotIndex = parseInt((formData.get('slotIndex') as string) || '0') || 0;

    // Optional visible signature placement (in PDF points)
    const x = typeof formData.get('x') === 'string' ? parseFloat(formData.get('x') as string) : NaN;
    const y = typeof formData.get('y') === 'string' ? parseFloat(formData.get('y') as string) : NaN;
    const width = typeof formData.get('width') === 'string' ? parseFloat(formData.get('width') as string) : NaN;
    const height = typeof formData.get('height') === 'string' ? parseFloat(formData.get('height') as string) : NaN;
    const pageIndex =
      typeof formData.get('pageIndex') === 'string'
        ? parseInt(formData.get('pageIndex') as string, 10) || 0
        : 0;

    if (!pdfFile) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      );
    }

    // Save uploaded file temporarily
    const tempPath = path.join(uploadsDir, `temp-${Date.now()}-${pdfFile.name}`);
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfBytes = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempPath, pdfBytes);

    // NOTE: keep API logs minimal in production

    if (!dscService.isInitialized) {
      const initResult = await dscService.initialize();
      if (!initResult.success) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return NextResponse.json(
          { error: 'DSC initialization failed', details: initResult.error },
          { status: 500 }
        );
      }
    }

    try {
      const certResult = await dscService.findCertificate(certificateIndex, slotIndex);
      if (!certResult.success) {
        throw new Error(certResult.error || 'Failed to find certificate');
      }
      const certificate = certResult.certificate;
      if (!certificate) {
        throw new Error('Certificate not available from token');
      }
      const certificateBuf: Buffer = Buffer.isBuffer(certificate)
        ? certificate
        : Buffer.from(certificate);

      // CRITICAL: Validate PIN FIRST before attempting any operations
      // If PIN is provided, we MUST verify it's correct
      if (pin) {
        // Close any existing session to force fresh authentication
        try {
          dscService.closeSession();
          dscService.isLoggedIn = false;
        } catch (e) {
          // Ignore errors closing session
        }
        
        // Attempt login with the provided PIN (for the selected slot)
        const loginResult = await dscService.login(pin, slotIndex);
        if (!loginResult.success) {
          // Check if it's a PIN error
          if (loginResult.error && (
            loginResult.error.includes('PIN') || 
            loginResult.error.includes('incorrect') ||
            loginResult.error.toLowerCase().includes('pin incorrect')
          )) {
            throw new Error('Incorrect PIN. Please check your PIN and try again.');
          }
          throw new Error(loginResult.error || 'Authentication failed. Please check your PIN.');
        }
        // PIN validated successfully
      } else {
        // If no PIN provided, warn but allow (some tokens don't require PIN)
        // No PIN provided; some tokens require PIN and signing may fail
      }

      const keyResult = await dscService.findPrivateKey(pin, certificateIndex, slotIndex);
      if (!keyResult.success) {
        // Check if error is related to PIN
        if (keyResult.error && (
          keyResult.error.includes('PIN') || 
          keyResult.error.includes('incorrect') ||
          keyResult.error.includes('authentication') ||
          keyResult.error.includes('Authentication failed')
        )) {
          throw new Error(keyResult.error);
        }
        throw new Error(keyResult.error || 'Failed to find private key. Check your PIN.');
      }

      const pkcs11Signer = async (hash: Buffer): Promise<Buffer> => {
        const signResult = await dscService.signData(hash, pin);
        if (!signResult.success) {
          throw new Error(signResult.error || 'PKCS#11 signing failed');
        }
        const sig = signResult.signature;
        if (!sig) {
          throw new Error('PKCS#11 signing returned no signature');
        }
        if (Buffer.isBuffer(sig)) return sig;
        if (sig instanceof Uint8Array) return Buffer.from(sig);
        if (typeof sig === 'string') return Buffer.from(sig, 'hex');
        throw new Error('PKCS#11 signing returned signature in an unsupported format');
      };

      const signOptions: any = {};
      if (!Number.isNaN(x)) signOptions.x = x;
      if (!Number.isNaN(y)) signOptions.y = y;
      if (!Number.isNaN(width)) signOptions.width = width;
      if (!Number.isNaN(height)) signOptions.height = height;
      signOptions.pageIndex = pageIndex;

      const signedPdfBytes = await pdfSignerPKCS11.signPDF(
        pdfBytes,
        certificateBuf,
        pkcs11Signer,
        signOptions
      );

      const originalFilename = pdfFile.name || 'document.pdf';
      const signedFilename = `signed-${Date.now()}-${originalFilename}`;
      const signedPath = path.join(uploadsDir, signedFilename);
      fs.writeFileSync(signedPath, signedPdfBytes);

      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      return NextResponse.json({
        success: true,
        signedFilename: signedFilename,
        signedUrl: `/uploads/${signedFilename}`,
        message: 'PDF signed successfully',
      });

    } catch (dscError: any) {
      console.error('DSC signing error:', dscError);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      if (dscError.message?.includes('PIN') || dscError.message?.includes('incorrect')) {
        return NextResponse.json(
          { error: 'Incorrect PIN', details: dscError.message },
          { status: 400 }
        );
      }

      if (dscError.message?.includes('No private key')) {
        return NextResponse.json(
          { error: 'Private key not accessible', details: dscError.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'DSC signing failed', details: dscError.message },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('PDF signing error:', error);
    return NextResponse.json(
      { error: 'Failed to sign PDF', details: error.message },
      { status: 500 }
    );
  }
}

