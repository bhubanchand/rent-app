import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// Re-export or import security-utils directly
// Since security-utils was written to src/lib/security-utils.ts, we can import from there
import {
  computeReceiptHash as hashFn,
  computeDigitalSignature as signFn,
  generateVerificationCode as codeFn,
} from '@/lib/security-utils';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request payload
    const body = await request.json();
    const { invoice_id, amount, payment_date, payment_method, transaction_id, notes } = body;

    if (!invoice_id || !amount || amount <= 0 || !payment_method) {
      return NextResponse.json({ error: 'Invalid fields' }, { status: 400 });
    }

    // 3. Retrieve invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, customer:customers(id, full_name, company_name, email, phone, address, gst_number), payments(amount)')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // 4. Calculate existing paid and remaining balance
    const currentPaid = invoice.payments
      ? invoice.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
      : 0;

    const remainingBalance = Number(invoice.amount) - currentPaid;

    if (amount > remainingBalance + 0.01) {
      return NextResponse.json(
        { error: `Payment amount exceeding remaining balance of ₹${remainingBalance}` },
        { status: 400 }
      );
    }

    // 5. Insert payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([
        {
          invoice_id,
          amount: Number(amount),
          payment_date: payment_date || new Date().toISOString().split('T')[0],
          payment_method,
          transaction_id: transaction_id || null,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (paymentError || !payment) {
      throw paymentError || new Error('Failed to create payment');
    }

    // 6. Generate auto-incremented receipt number RCP-YYYY-XXXXXX
    const year = new Date().getFullYear();
    const { count, error: countError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .like('receipt_number', `RCP-${year}-%`);

    if (countError) throw countError;
    const nextReceiptNum = `RCP-${year}-${String((count || 0) + 1).padStart(6, '0')}`;

    // 7. Compute cryptographic details
    const integrityHash = hashFn({
      receiptNumber: nextReceiptNum,
      amount: Number(amount),
      paymentDate: payment.payment_date,
      customerId: invoice.customer_id,
      transactionId: transaction_id || '',
    });

    const digitalSignature = signFn(integrityHash);
    const verificationCode = codeFn();

    // 8. Insert receipt record
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert([
        {
          payment_id: payment.id,
          receipt_number: nextReceiptNum,
          verification_code: verificationCode,
          digital_signature: digitalSignature,
          sha256_hash: integrityHash,
        },
      ])
      .select()
      .single();

    if (receiptError || !receipt) {
      throw receiptError || new Error('Failed to create receipt');
    }

    // 9. Update Invoice Status
    const newPaidTotal = currentPaid + Number(amount);
    let newStatus = 'partially_paid';
    if (newPaidTotal >= Number(invoice.amount) - 0.01) {
      newStatus = 'paid';
    }

    const { error: updateInvoiceError } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoice_id);

    if (updateInvoiceError) throw updateInvoiceError;

    // 10. Log audit logs security event via adminClient (or relies on DB triggers)
    // DB Triggers are already handling inserts into payments, receipts, and invoices updates!

    return NextResponse.json({ success: true, payment, receipt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
