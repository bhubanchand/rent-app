import crypto from 'crypto';

/**
 * Computes a SHA-256 integrity hash over receipt fields to prevent tampering.
 */
export function computeReceiptHash(params: {
  receiptNumber: string;
  amount: number;
  paymentDate: string;
  customerId: string;
  transactionId?: string;
}): string {
  const payload = [
    params.receiptNumber,
    params.amount.toFixed(2),
    params.paymentDate,
    params.customerId,
    params.transactionId || '',
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Computes a digital signature (HMAC-SHA256) of the integrity hash using a private server secret.
 */
export function computeDigitalSignature(hash: string): string {
  const secret = process.env.RECEIPT_SIGNING_SECRET;
  if (!secret) {
    throw new Error('RECEIPT_SIGNING_SECRET environment variable is not set.');
  }
  return crypto.createHmac('sha256', secret).update(hash).digest('hex');
}

/**
 * Generates a high-entropy, short, alphanumeric verification code.
 * Example: 'RCP-8A2F9B'
 */
export function generateVerificationCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Computes a digital signature (HMAC-SHA256) for an invoice number to prevent public enumeration.
 */
export function signInvoiceNumber(invoiceNumber: string): string {
  const secret = process.env.RECEIPT_SIGNING_SECRET;
  if (!secret) {
    throw new Error('RECEIPT_SIGNING_SECRET environment variable is not set.');
  }
  return crypto.createHmac('sha256', secret).update(invoiceNumber).digest('hex').slice(0, 16);
}

