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

    // Prevent querying and false positives if Supabase keys are missing or invalid (dummy mode)
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      (!process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http://') &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://'))
    ) {
      return NextResponse.json({
        status: 'INVALID',
        message: 'Cryptographic verification ledger is currently offline. Connection parameters are not configured.'
      });
    }

    const adminSupabase = createAdminClient();

    // 2. Search in Receipts (by verification_code or receipt_number)
    const { data: receipt, error: receiptError } = await adminSupabase
      .from('receipts')
      .select(`
        id,
        receipt_number,
        verification_code,
        sha256_hash,
        digital_signature,
        created_at,
        payment:payments(
          amount,
          payment_date,
          payment_method,
          transaction_id,
          invoice:invoices(
            invoice_number,
            customer:customers(
              full_name,
              company_name,
              email,
              phone
            )
          )
        )
      `)
      .or(`verification_code.eq.${cleanCode},receipt_number.eq.${cleanCode}`)
      .maybeSingle();

    if (receiptError) {
      console.error('[Verification API] Receipts query error:', receiptError);
      if (receiptError.message?.includes('Unregistered API key')) {
        return NextResponse.json({
          status: 'INVALID',
          message: 'Cryptographic verification ledger is offline. The server service role key is invalid or unregistered.'
        });
      }
    }

    if (receipt && !Array.isArray(receipt) && receipt.receipt_number) {
      const payment: any = receipt.payment;
      const customer: any = payment?.invoice?.customer;
      const customerName = customer?.full_name || 'N/A';
      
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
        statusText: 'Paid',
        details: {
          receipt_number: receipt.receipt_number,
          verification_code: receipt.verification_code,
          sha256_hash: receipt.sha255_hash || receipt.sha256_hash,
          digital_signature: receipt.digital_signature,
          payment: {
            amount: payment?.amount || 0,
            payment_date: payment?.payment_date || '',
            payment_method: payment?.payment_method || 'cash',
            transaction_id: payment?.transaction_id || null,
            invoice: {
              invoice_number: payment?.invoice?.invoice_number || 'N/A'
            }
          },
          customer: {
            full_name: customer?.full_name || 'N/A',
            company_name: customer?.company_name || null,
            email: customer?.email || '',
            phone: customer?.phone || null
          }
        }
      });
    }

    // 3. Search in Invoices (by invoice_number)
    const { data: invoice, error: invoiceError } = await adminSupabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        amount,
        currency,
        issue_date,
        due_date,
        description,
        status,
        customer:customers(
          full_name,
          company_name,
          email,
          phone,
          address,
          gst_number
        ),
        payments(
          amount,
          payment_date,
          payment_method
        )
      `)
      .eq('invoice_number', cleanCode)
      .maybeSingle();

    if (invoiceError) {
      console.error('[Verification API] Invoices query error:', invoiceError);
      if (invoiceError.message?.includes('Unregistered API key')) {
        return NextResponse.json({
          status: 'INVALID',
          message: 'Cryptographic verification ledger is offline. The server service role key is invalid or unregistered.'
        });
      }
    }

    if (invoice && !Array.isArray(invoice) && invoice.invoice_number) {
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
        statusText: invoice.status.replace('_', ' '),
        details: {
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency || 'INR',
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          description: invoice.description,
          status: invoice.status,
          customer: {
            full_name: customer?.full_name || 'N/A',
            company_name: customer?.company_name || null,
            email: customer?.email || '',
            phone: customer?.phone || null,
            address: customer?.address || null,
            gst_number: customer?.gst_number || null
          },
          payments: invoice.payments || []
        }
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

