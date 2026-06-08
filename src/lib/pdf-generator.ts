import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

type InvoiceData = {
  invoice_number: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  description: string | null;
  status: string;
  customer: {
    full_name: string;
    company_name: string | null;
    email: string;
    phone: string | null;
    address: string | null;
    gst_number: string | null;
  };
  payments?: { amount: number; payment_date: string; payment_method: string }[];
};

type ReceiptData = {
  receipt_number: string;
  verification_code: string;
  sha256_hash: string;
  digital_signature: string;
  payment: {
    amount: number;
    payment_date: string;
    payment_method: string;
    transaction_id: string | null;
    invoice: {
      invoice_number: string;
    };
  };
  customer: {
    full_name: string;
    company_name: string | null;
    email: string;
    phone: string | null;
  };
};

/**
 * Generates and downloads a professional PDF for an invoice.
 */
export async function generateInvoicePdf(invoice: InvoiceData) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  const verificationUrl = `${appUrl}/verify?code=${invoice.invoice_number}`;
  const qrCodeUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 200 });

  // 1. Draw branding/header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('RentApp', 15, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('INVOICE OF BILLING', 15, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', 195, 22, { align: 'right' });

  // 2. Invoice Meta Details
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Invoice Number: ${invoice.invoice_number}`, 15, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Issue Date: ${invoice.issue_date}`, 15, 54);
  doc.text(`Due Date: ${invoice.due_date}`, 15, 59);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 15, 64);

  // 3. Client & Provider Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Bill To:', 120, 48);

  doc.setFont('helvetica', 'semibold');
  doc.setFontSize(9);
  doc.text(invoice.customer.full_name, 120, 54);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (invoice.customer.company_name) {
    doc.text(invoice.customer.company_name, 120, 59);
  }
  doc.text(`Email: ${invoice.customer.email}`, 120, 64);
  if (invoice.customer.phone) {
    doc.text(`Phone: ${invoice.customer.phone}`, 120, 69);
  }
  if (invoice.customer.gst_number) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`GSTIN: ${invoice.customer.gst_number}`, 120, 75);
  }

  // 4. Line Items Table
  const totalAmount = Number(invoice.amount);
  const paidAmount = invoice.payments
    ? invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  autoTable(doc, {
    startY: 85,
    head: [['Description', 'Amount']],
    body: [[invoice.description || 'Billing Services / Rental Agreement Charges', `INR ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]],
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;

  // 5. Total Calculations Breakdown Box
  doc.setFillColor(248, 250, 252);
  doc.rect(115, currentY, 80, 25, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Invoiced:', 120, currentY + 6);
  doc.text('Amount Paid:', 120, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Balance Due:', 120, currentY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`INR ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 6, { align: 'right' });
  doc.text(`INR ${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 12, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // indigo
  doc.text(`INR ${remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, currentY + 19, { align: 'right' });

  // 6. Draw QR Code for Verification
  doc.addImage(qrCodeUrl, 'PNG', 15, currentY, 32, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('VERIFIABLE INVOICE', 52, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Scan the QR code to verify details', 52, currentY + 15);
  doc.text('on the official verification page.', 52, currentY + 19);

  // 7. Payment History Table (if payments exist)
  if (invoice.payments && invoice.payments.length > 0) {
    currentY += 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Receipts & Partial Payments History:', 15, currentY);

    const paymentRows = invoice.payments.map((p, index) => [
      `Receipt #${index + 1}`,
      p.payment_date,
      p.payment_method.toUpperCase(),
      `INR ${Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Ref', 'Date', 'Method', 'Amount Paid']],
      body: paymentRows,
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [100, 116, 139], fontSize: 8 },
    });
  }

  // Save PDF file
  doc.save(`${invoice.invoice_number}.pdf`);
}

/**
 * Generates and downloads a professional PDF for a payment receipt.
 */
export async function generateReceiptPdf(receipt: ReceiptData) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  const verificationUrl = `${appUrl}/verify?code=${receipt.verification_code}`;
  const qrCodeUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 200 });

  // 1. Header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('RentApp', 15, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('OFFICIAL TRANSACTION RECEIPT', 15, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('RECEIPT', 195, 22, { align: 'right' });

  // 2. Receipt Details
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Receipt Number: ${receipt.receipt_number}`, 15, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Payment Date: ${receipt.payment.payment_date}`, 15, 54);
  doc.text(`Payment Method: ${receipt.payment.payment_method.toUpperCase()}`, 15, 59);
  if (receipt.payment.transaction_id) {
    doc.text(`Transaction ID: ${receipt.payment.transaction_id}`, 15, 64);
  }
  doc.text(`Invoice Ref: ${receipt.payment.invoice.invoice_number}`, 15, 69);

  // 3. Customer Info
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Info:', 120, 48);
  doc.setFont('helvetica', 'semibold');
  doc.text(receipt.customer.full_name, 120, 54);
  doc.setFont('helvetica', 'normal');
  if (receipt.customer.company_name) {
    doc.text(receipt.customer.company_name, 120, 59);
  }
  doc.text(`Email: ${receipt.customer.email}`, 120, 64);
  if (receipt.customer.phone) {
    doc.text(`Phone: ${receipt.customer.phone}`, 120, 69);
  }

  // 4. Amount Received Box
  doc.setFillColor(240, 253, 250); // emerald-50
  doc.rect(15, 80, 180, 22, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(13, 148, 136); // emerald-600
  doc.text('AMOUNT RECEIVED', 25, 93);
  doc.setFontSize(14);
  doc.text(`INR ${Number(receipt.payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, 93, { align: 'right' });

  // 5. Verification QR code
  const currentY = 112;
  doc.addImage(qrCodeUrl, 'PNG', 15, currentY, 35, 35);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('SECURE TRANSACTION RECEIPT', 58, currentY + 6);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Verification Code: ${receipt.verification_code}`, 58, currentY + 12);
  doc.text('This receipt is cryptographically sealed for integrity.', 58, currentY + 17);
  doc.text('Scan the QR code to verify receipt validity online.', 58, currentY + 22);

  // 6. Cryptographic Hashes & Signatures
  doc.setFillColor(248, 250, 252);
  doc.rect(15, currentY + 45, 180, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('SHA-256 INTEGRITY HASH:', 20, currentY + 51);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(receipt.sha256_hash, 20, currentY + 55);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('HMAC DIGITAL SIGNATURE:', 20, currentY + 61);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(receipt.digital_signature, 20, currentY + 65);

  // 7. Footer Seal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('GENUINE RentApp DIGITAL DOCUMENT - VALID UNTIL REVOKED', 105, 280, { align: 'center' });

  // Save PDF file
  doc.save(`${receipt.receipt_number}.pdf`);
}
