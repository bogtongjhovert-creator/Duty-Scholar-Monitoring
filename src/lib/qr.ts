import QRCode from 'qrcode';

/**
 * Generate a secure QR Code Data URL from a scholar's unique token
 */
export async function generateQrDataUrl(qrToken: string, size = 300): Promise<string> {
  try {
    return await QRCode.toDataURL(qrToken, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

/**
 * Clean and normalize scanned QR text
 */
export function sanitizeScannedQr(rawText: string): string {
  return rawText.trim();
}
