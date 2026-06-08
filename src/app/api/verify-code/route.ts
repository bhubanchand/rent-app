import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Enforce rate limiting: 5 verification attempts per minute per IP
    const limitResult = rateLimit(ip, 5, 60000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const adminSupabase = createAdminClient();

    // 2. Search in Receipts (by verification_code or receipt_number)
    const { data: receipt, error: receiptError } = await adminSupabase
      .from('receipts')
      .select(`
        receipt_number,
        verification_code,
        payment:payments(
          amount,
          payment_date,
          invoice:invoices(
            customer:customers(full_name)
          )
        )
      `)
      .or(`verification_code.eq.${cleanCode},receipt_number.eq.${cleanCode}`)
      .maybeSingle();

    if (receipt) {
      const payment: any = receipt.payment;
      const customerName = payment?.invoice?.customer?.full_name || 'N/A';
      
      // Log verification event
      await adminSupabase.from('audit_logs').insert([
        {
          user_id: null,
          action: `QR_VERIFY_SUCCESS receipt_number=${receipt.receipt_number}`,
          ip_address: ip,
          new_value: { code: cleanCode, type: 'receipt' }
        }
      ]);

      return NextResponse.json({
        status: 'VALID',
        type: 'receipt',
        number: receipt.receipt_number,
        customerName,
        amount: payment?.amount || 0,
        date: payment?.payment_date || '',
        statusText: 'Paid'
      });
    }

    // 3. Search in Invoices (by invoice_number)
    const { data: invoice, error: invoiceError } = await adminSupabase
      .from('invoices')
      .select(`
        invoice_number,
        amount,
        issue_date,
        status,
        customer:customers(full_name)
      `)
      .eq('invoice_number', cleanCode)
      .maybeSingle();

    if (invoice) {
      const customer: any = invoice.customer;
      
      // Log verification event
      await adminSupabase.from('audit_logs').insert([
        {
          user_id: null,
          action: `QR_VERIFY_SUCCESS invoice_number=${invoice.invoice_number}`,
          ip_address: ip,
          new_value: { code: cleanCode, type: 'invoice' }
        }
      ]);

      return NextResponse.json({
        status: 'VALID',
        type: 'invoice',
        number: invoice.invoice_number,
        customerName: customer?.full_name || 'N/A',
        amount: invoice.amount,
        date: invoice.issue_date,
        statusText: invoice.status.replace('_', ' ')
      });
    }

    // 4. Log failure attempt for security audit
    await adminSupabase.from('audit_logs').insert([
      {
        user_id: null,
        action: `QR_VERIFY_FAILURE code=${cleanCode}`,
        ip_address: ip,
        new_value: { code: cleanCode, remaining_attempts: limitResult.remaining }
      }
    ]);

    // Code is invalid. Return INVALID status with no extra metadata to prevent enumeration.
    return NextResponse.json({
      status: 'INVALID',
      message: 'The code provided does not match any registered invoice or receipt in our system.'
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
