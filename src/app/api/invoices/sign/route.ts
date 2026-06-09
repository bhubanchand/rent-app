import { NextRequest, NextResponse } from 'next/server';
import { signInvoiceNumber } from '@/lib/security-utils';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const sig = signInvoiceNumber(code);
    return NextResponse.json({ sig });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
