import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Validate the share link token
    const { data: shareLink, error: shareLinkError } = await adminSupabase
      .from('share_links')
      .select('*')
      .eq('token', token)
      .single();

    if (shareLinkError || !shareLink) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    // Check active status
    if (!shareLink.is_active) {
      return NextResponse.json({ error: 'This link has been disabled' }, { status: 403 });
    }

    // Check expiry
    if (shareLink.expires_at && new Date(shareLink.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 403 });
    }

    // 2. Fetch Customer Details (excluding notes/internal data)
    const { data: customer, error: customerError } = await adminSupabase
      .from('customers')
      .select('id, full_name, company_name, email, phone, address')
      .eq('id', shareLink.customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // 3. Fetch Customer Invoices (excluding internal notes / meta)
    const { data: invoices, error: invoicesError } = await adminSupabase
      .from('invoices')
      .select('id, invoice_number, amount, currency, issue_date, due_date, description, status')
      .eq('customer_id', customer.id)
      .order('issue_date', { ascending: false });

    if (invoicesError) throw invoicesError;

    // 4. Fetch Payments & Receipts for those invoices
    const invoiceIds = (invoices || []).map((i) => i.id);
    let payments: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await adminSupabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_method,
          transaction_id,
          invoice_id,
          receipt:receipts(receipt_number, verification_code, sha256_hash, digital_signature)
        `)
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      payments = paymentsData || [];
    }

    // Log public access activity to the audit trail
    // Since this is guest access, user_id is NULL
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    await adminSupabase.from('audit_logs').insert([
      {
        user_id: null,
        action: `PUBLIC_PORTAL_ACCESS customer_id=${customer.id}`,
        ip_address: ipAddress,
        new_value: { token_id: shareLink.id, accessed_at: new Date().toISOString() },
      },
    ]);

    return NextResponse.json({
      customer,
      invoices,
      payments,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
