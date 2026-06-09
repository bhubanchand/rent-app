'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface TableAuditResult {
  tableName: string;
  exists: boolean;
  error: string | null;
}

export interface DiagnosticsResult {
  urlDetected: boolean;
  urlValueSanitized: string;
  urlValidFormat: boolean;
  anonKeyDetected: boolean;
  anonKeySanitized: string;
  anonKeyValidFormat: boolean;
  serviceKeyDetected: boolean;
  serviceKeySanitized: string;
  serviceKeyValidFormat: boolean;
  signingSecretDetected: boolean;
  signingSecretLength: number;
  serverClientInitializable: boolean;
  serverClientError: string | null;
  adminClientInitializable: boolean;
  adminClientError: string | null;
  networkChecks: {
    urlReachable: boolean;
    authReachable: boolean;
    restReachable: boolean;
    restStatus: number | null;
    restError: string | null;
    authStatus: number | null;
    authError: string | null;
  };
  tablesAudit: TableAuditResult[];
}

export async function runServerDiagnostics(): Promise<DiagnosticsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const signingSecret = process.env.RECEIPT_SIGNING_SECRET || '';

  const urlDetected = !!url;
  const urlValueSanitized = url ? url.replace(/^(https?:\/\/)[^@/]+/, '$1***') : 'Not Set';
  const urlValidFormat = url.startsWith('http://') || url.startsWith('https://');

  const anonKeyDetected = !!anonKey;
  const anonKeyValidFormat = anonKey.startsWith('eyJ');
  const anonKeySanitized = anonKey 
    ? `${anonKey.substring(0, 8)}...${anonKey.substring(anonKey.length - 8)}`
    : 'Not Set';

  const serviceKeyDetected = !!serviceKey;
  const serviceKeyValidFormat = serviceKey.startsWith('eyJ');
  const serviceKeySanitized = serviceKey
    ? `${serviceKey.substring(0, 8)}...${serviceKey.substring(serviceKey.length - 8)}`
    : 'Not Set';

  const signingSecretDetected = !!signingSecret;
  const signingSecretLength = signingSecret.length;

  let serverClientInitializable = false;
  let serverClientError: string | null = null;

  try {
    if (!urlDetected) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
    if (!anonKeyDetected) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!urlValidFormat) throw new Error('Invalid NEXT_PUBLIC_SUPABASE_URL format');
    serverClientInitializable = true;
  } catch (err: any) {
    serverClientError = err.message;
  }

  let adminClientInitializable = false;
  let adminClientError: string | null = null;
  let adminClient: any = null;

  try {
    if (!urlDetected) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceKeyDetected) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    if (!urlValidFormat) throw new Error('Invalid NEXT_PUBLIC_SUPABASE_URL format');
    
    adminClient = createAdminClient();
    adminClientInitializable = true;
  } catch (err: any) {
    adminClientError = err.message;
  }

  const networkChecks = {
    urlReachable: false,
    authReachable: false,
    restReachable: false,
    restStatus: null as number | null,
    restError: null as string | null,
    authStatus: null as number | null,
    authError: null as string | null,
  };

  if (urlDetected && urlValidFormat) {
    // 1. Check general URL ping
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      await fetch(url, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
      clearTimeout(id);
      networkChecks.urlReachable = true;
    } catch (err: any) {
      networkChecks.urlReachable = false;
    }

    // 2. Check Auth endpoint
    try {
      const authUrl = `${url}/auth/v1/health`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(authUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(id);
      networkChecks.authStatus = res.status;
      networkChecks.authReachable = res.ok;
      if (!res.ok) {
        networkChecks.authError = `HTTP ${res.status}: ${await res.text().catch(() => 'Unknown')}`;
      }
    } catch (err: any) {
      networkChecks.authError = err.message || 'Connection failed';
    }

    // 3. Check REST endpoint
    try {
      const restUrl = `${url}/rest/v1/`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(restUrl, {
        headers: { apikey: anonKey },
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(id);
      networkChecks.restStatus = res.status;
      networkChecks.restReachable = res.ok;
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        try {
          const parsed = JSON.parse(bodyText);
          networkChecks.restError = parsed.message || bodyText;
        } catch {
          networkChecks.restError = bodyText || `HTTP ${res.status}`;
        }
      }
    } catch (err: any) {
      networkChecks.restError = err.message || 'Connection failed';
    }
  }

  // 4. Perform database tables audit
  const expectedTables = [
    'customers',
    'invoices',
    'payments',
    'receipts',
    'share_links',
    'verification_codes',
    'audit_logs',
    'attachments',
    'custom_fields'
  ];

  const tablesAudit: TableAuditResult[] = [];

  if (adminClientInitializable && adminClient) {
    for (const table of expectedTables) {
      try {
        // Query the table for a single record to check existence
        const { error } = await adminClient
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          // If the relation doesn't exist, code is usually '42P01'
          if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
            tablesAudit.push({
              tableName: table,
              exists: false,
              error: 'Table does not exist in the database.'
            });
          } else {
            // Other error (e.g. permission or type error, but table exists)
            tablesAudit.push({
              tableName: table,
              exists: true,
              error: `Table exists but query failed: ${error.message} (${error.code})`
            });
          }
        } else {
          tablesAudit.push({
            tableName: table,
            exists: true,
            error: null
          });
        }
      } catch (err: any) {
        tablesAudit.push({
          tableName: table,
          exists: false,
          error: `Audit request failed: ${err.message}`
        });
      }
    }
  } else {
    // If admin client could not be initialized, populate expected tables as unchecked
    for (const table of expectedTables) {
      tablesAudit.push({
        tableName: table,
        exists: false,
        error: adminClientError || 'Admin client not initialized (missing SUPABASE_SERVICE_ROLE_KEY).'
      });
    }
  }

  return {
    urlDetected,
    urlValueSanitized,
    urlValidFormat,
    anonKeyDetected,
    anonKeySanitized,
    anonKeyValidFormat,
    serviceKeyDetected,
    serviceKeySanitized,
    serviceKeyValidFormat,
    signingSecretDetected,
    signingSecretLength,
    serverClientInitializable,
    serverClientError,
    adminClientInitializable,
    adminClientError,
    networkChecks,
    tablesAudit,
  };
}
