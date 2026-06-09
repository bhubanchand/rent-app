'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Globe, 
  Database, 
  Key, 
  Lock, 
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { runServerDiagnostics, DiagnosticsResult } from './actions';

export default function SupabaseDebugPage() {
  const router = useRouter();
  const [serverDiag, setServerDiag] = useState<DiagnosticsResult | null>(null);
  const [clientDiag, setClientDiag] = useState<{
    initializable: boolean;
    error: string | null;
    sessionChecked: boolean;
    sessionState: string;
    connectionTestStatus: 'idle' | 'testing' | 'success' | 'failed';
    connectionTestMessage: string | null;
  }>({
    initializable: false,
    error: null,
    sessionChecked: false,
    sessionState: 'Not Checked',
    connectionTestStatus: 'idle',
    connectionTestMessage: null
  });

  const [loading, setLoading] = useState(true);

  const runAllDiagnostics = async () => {
    setLoading(true);
    try {
      // 1. Run Server Diagnostics
      const sResult = await runServerDiagnostics();
      setServerDiag(sResult);

      // 2. Run Client Diagnostics
      let isClientInitializable = false;
      let clientErrorMsg: string | null = null;
      let clientSessionState = 'Not Checked';
      let clientSessionChecked = false;

      try {
        const supabase = createClient();
        isClientInitializable = true;
        
        // Try getting session
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        clientSessionChecked = true;
        if (sessionErr) {
          clientSessionState = `Error: ${sessionErr.message}`;
        } else if (session) {
          clientSessionState = `Authenticated (User: ${session.user.email})`;
        } else {
          clientSessionState = 'Unauthenticated (No Session)';
        }
      } catch (err: any) {
        clientErrorMsg = err.message || 'Client initialization failed';
        clientSessionState = 'Failed to load client';
      }

      setClientDiag(prev => ({
        ...prev,
        initializable: isClientInitializable,
        error: clientErrorMsg,
        sessionChecked: clientSessionChecked,
        sessionState: clientSessionState
      }));

      toast.success('Diagnostics complete.');
    } catch (err: any) {
      toast.error('Diagnostics failed to run: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAllDiagnostics();
  }, []);

  const handleTestClientConnection = async () => {
    setClientDiag(prev => ({
      ...prev,
      connectionTestStatus: 'testing',
      connectionTestMessage: null
    }));

    try {
      const supabase = createClient();
      
      const startTime = Date.now();
      const { data, error } = await supabase.auth.getSession();
      const latency = Date.now() - startTime;

      if (error) {
        throw error;
      }

      // Check if we can hit database
      const dbCheck = await supabase.from('customers').select('id').limit(1);
      
      let dbStatus = 'DB Reachable';
      if (dbCheck.error) {
        if (dbCheck.error.code === 'PGRST116' || dbCheck.error.code === 'PGRST301' || dbCheck.status === 401) {
          dbStatus = `DB Handshake Successful (Response: ${dbCheck.error.message})`;
        } else {
          dbStatus = `DB Error: ${dbCheck.error.message}`;
        }
      }

      setClientDiag(prev => ({
        ...prev,
        connectionTestStatus: 'success',
        connectionTestMessage: `Connection Successful! Latency: ${latency}ms. Auth state: ${data.session ? 'Logged In' : 'Logged Out'}. ${dbStatus}`
      }));
      toast.success('Connection test succeeded.');
    } catch (err: any) {
      console.error('[Supabase Debug] Client connection test failed:', err);
      
      let userFriendlyMessage = err.message || 'Network / CORS connection failed';
      if (userFriendlyMessage.includes('Failed to fetch')) {
        userFriendlyMessage = 'Failed to fetch (Possible causes: Blocked by CORS, invalid API Gateway endpoint, or your Supabase Anon Key is unregistered for this domain).';
      }

      setClientDiag(prev => ({
        ...prev,
        connectionTestStatus: 'failed',
        connectionTestMessage: userFriendlyMessage
      }));
      toast.error('Connection test failed.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-slate-950 p-4 sm:p-8 font-sans text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      
      <div className="w-full max-w-4xl z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => router.push('/login')} 
              className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Supabase Integration Audit
              </h1>
              <p className="text-sm text-slate-400">Diagnostic dashboard for authentication & database connection status</p>
            </div>
          </div>
          <Button 
            onClick={runAllDiagnostics} 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reload
          </Button>
        </div>

        {/* Diagnostic Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Environment Variables & Format Audits */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md text-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Key className="h-5 w-5 text-indigo-400" />
                <span>Environment Variables</span>
              </CardTitle>
              <CardDescription className="text-slate-400">
                Verifying local/server configuration values & format constraints.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex justify-center p-6"><LoaderSkeleton /></div>
              ) : (
                <div className="space-y-3">
                  <DiagItem 
                    title="NEXT_PUBLIC_SUPABASE_URL"
                    status={serverDiag?.urlDetected ? (serverDiag.urlValidFormat ? 'success' : 'warning') : 'error'}
                    info={serverDiag?.urlValueSanitized}
                    message={!serverDiag?.urlDetected ? 'Missing variable' : !serverDiag?.urlValidFormat ? 'Must begin with http/https' : 'Loaded'}
                  />
                  <DiagItem 
                    title="NEXT_PUBLIC_SUPABASE_ANON_KEY"
                    status={serverDiag?.anonKeyDetected ? (serverDiag.anonKeyValidFormat ? 'success' : 'error') : 'error'}
                    info={serverDiag?.anonKeySanitized}
                    message={
                      !serverDiag?.anonKeyDetected 
                        ? 'Missing variable' 
                        : !serverDiag?.anonKeyValidFormat 
                        ? 'Invalid Key: Must be a JWT token starting with "eyJ"' 
                        : 'Loaded (Valid format)'
                    }
                  />
                  <DiagItem 
                    title="SUPABASE_SERVICE_ROLE_KEY"
                    status={serverDiag?.serviceKeyDetected ? (serverDiag.serviceKeyValidFormat ? 'success' : 'error') : 'error'}
                    info={serverDiag?.serviceKeySanitized}
                    message={
                      !serverDiag?.serviceKeyDetected 
                        ? 'Missing variable (Bypasses verification & PDF generation)' 
                        : !serverDiag?.serviceKeyValidFormat 
                        ? 'Invalid Key: Must be a JWT token starting with "eyJ"' 
                        : 'Loaded (Valid format)'
                    }
                  />
                  <DiagItem 
                    title="RECEIPT_SIGNING_SECRET"
                    status={serverDiag?.signingSecretDetected ? (serverDiag.signingSecretLength >= 32 ? 'success' : 'warning') : 'error'}
                    info={serverDiag?.signingSecretDetected ? `Length: ${serverDiag.signingSecretLength} chars` : 'Not Set'}
                    message={
                      !serverDiag?.signingSecretDetected 
                        ? 'Missing signing secret (Receipt generation will fail)' 
                        : serverDiag.signingSecretLength < 32 
                        ? 'Weak key: Recommended size >= 32 chars' 
                        : 'Loaded'
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Network & Endpoint Audit */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md text-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Globe className="h-5 w-5 text-emerald-400" />
                <span>Endpoint Reachability</span>
              </CardTitle>
              <CardDescription className="text-slate-400">
                Ping tests to Supabase cloud routing gateways and containers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex justify-center p-6"><LoaderSkeleton /></div>
              ) : (
                <div className="space-y-3">
                  <DiagItem 
                    title="General URL Endpoint"
                    status={serverDiag?.networkChecks.urlReachable ? 'success' : 'error'}
                    message={serverDiag?.networkChecks.urlReachable ? 'Reachable' : 'Host unreachable (DNS check failed)'}
                  />
                  <DiagItem 
                    title="Supabase Auth API (GoTrue)"
                    status={serverDiag?.networkChecks.authReachable ? 'success' : 'error'}
                    info={serverDiag?.networkChecks.authStatus ? `Status: ${serverDiag.networkChecks.authStatus}` : undefined}
                    message={serverDiag?.networkChecks.authError || 'Healthy'}
                  />
                  <DiagItem 
                    title="Supabase PostgREST API"
                    status={serverDiag?.networkChecks.restReachable ? 'success' : 'error'}
                    info={serverDiag?.networkChecks.restStatus ? `Status: ${serverDiag.networkChecks.restStatus}` : undefined}
                    message={serverDiag?.networkChecks.restError || 'Authorized & Reachable'}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Database Tables Audit */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md text-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <Database className="h-5 w-5 text-indigo-400" />
              <span>Database Tables Audit</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Verifying whether all required application tables exist in the PostgreSQL schema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-6"><LoaderSkeleton /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {serverDiag?.tablesAudit.map((table) => (
                  <div 
                    key={table.tableName}
                    className={`flex items-start justify-between p-3 rounded-lg border bg-slate-950/30 transition-colors ${
                      table.exists && !table.error
                        ? 'border-slate-800 hover:bg-slate-950/60'
                        : table.exists
                        ? 'border-amber-900/40 hover:bg-amber-950/10'
                        : 'border-rose-900/40 hover:bg-rose-950/10'
                    }`}
                  >
                    <div className="space-y-1 mr-3 min-w-0">
                      <p className="text-xs font-semibold text-slate-300 truncate">{table.tableName}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {table.exists 
                          ? (table.error && !table.error.includes('exists') ? 'Error' : 'Table exists') 
                          : 'Table missing'}
                      </p>
                      {table.error && (
                        <p className={`text-[9px] font-mono leading-tight truncate ${
                          table.exists ? 'text-amber-400' : 'text-rose-400'
                        }`} title={table.error}>
                          {table.error}
                        </p>
                      )}
                    </div>
                    <div className="pt-0.5 shrink-0">
                      {table.exists && !table.error ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                      ) : table.exists ? (
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Initialization & Connection Tester */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md text-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <Server className="h-5 w-5 text-indigo-400" />
              <span>Client Initialization & Connection Test</span>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Verifying whether the browser-side client registers and executes connection handshake successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center p-6"><LoaderSkeleton /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Client State</h3>
                  <div className="space-y-3">
                    <DiagItem 
                      title="createBrowserClient() Setup"
                      status={clientDiag.initializable ? 'success' : 'error'}
                      message={clientDiag.error || 'Successfully Initialized'}
                    />
                    <DiagItem 
                      title="Session Retrieval Status"
                      status={clientDiag.sessionChecked ? 'success' : 'warning'}
                      message={clientDiag.sessionState}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300">Run Client Connection Handshake</h3>
                    <p className="text-xs text-slate-400">
                      Executes an active API request (`supabase.auth.getSession()` and queries `customers` table) using the browser configuration.
                    </p>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    <Button 
                      onClick={handleTestClientConnection}
                      disabled={clientDiag.connectionTestStatus === 'testing' || !clientDiag.initializable}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      {clientDiag.connectionTestStatus === 'testing' ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Testing Handshake...
                        </>
                      ) : (
                        'Test Client Connection'
                      )}
                    </Button>

                    {clientDiag.connectionTestStatus !== 'idle' && (
                      <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                        clientDiag.connectionTestStatus === 'success' 
                          ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300' 
                          : clientDiag.connectionTestStatus === 'failed'
                          ? 'bg-red-950/50 border border-red-900/60 text-red-300'
                          : 'bg-slate-900 border border-slate-800 text-slate-300'
                      }`}>
                        {clientDiag.connectionTestStatus === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
                        {clientDiag.connectionTestStatus === 'failed' && <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                        {clientDiag.connectionTestStatus === 'testing' && <RefreshCw className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5 animate-spin" />}
                        <span>{clientDiag.connectionTestMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warning card for invalid keys */}
        {!loading && serverDiag && (!serverDiag.anonKeyValidFormat || (serverDiag.urlDetected && !serverDiag.networkChecks.restReachable)) && (
          <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-200 space-y-2">
            <h3 className="font-semibold flex items-center space-x-2 text-rose-400 text-base">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Supabase Configuration Issue Detected</span>
            </h3>
            <div className="text-xs space-y-2 leading-relaxed">
              {!serverDiag.anonKeyValidFormat && (
                <p>
                  <strong>Unregistered / Invalid Publishable Key format:</strong> Your `NEXT_PUBLIC_SUPABASE_ANON_KEY` does not start with <code>&quot;eyJ&quot;</code>. Supabase API keys are JSON Web Tokens (JWTs). The current key prefix suggests it might be a secret/publishable key template or a key from another provider. Please verify your keys in the Supabase Dashboard under <strong>Project Settings &gt; API</strong>.
                </p>
              )}
              {serverDiag.networkChecks.restStatus === 401 && serverDiag.networkChecks.restError?.includes('Unregistered') && (
                <p>
                  <strong>Unregistered API key:</strong> The Supabase API Gateway rejected the credentials with <code>sb-error-code: UNAUTHORIZED_UNREGISTERED_API_KEY</code>. This indicates that the anon key is structurally valid (or accepted by the gateway) but does not match the project referenced at <code>{serverDiag.urlValueSanitized}</code>.
                </p>
              )}
              {serverDiag.networkChecks.restError && !serverDiag.networkChecks.restError.includes('Unregistered') && (
                <p>
                  <strong>REST Service Error:</strong> {serverDiag.networkChecks.restError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagItem({ 
  title, 
  status, 
  info, 
  message 
}: { 
  title: string; 
  status: 'success' | 'warning' | 'error'; 
  info?: string; 
  message?: string; 
}) {
  const getIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />;
      case 'error':
        return <XCircle className="h-4.5 w-4.5 text-rose-500 shrink-0" />;
    }
  };

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/30 hover:bg-slate-950/60 transition-colors">
      <div className="space-y-1 mr-3 min-w-0">
        <p className="text-xs font-semibold text-slate-300 truncate">{title}</p>
        {info && <p className="text-[10px] font-mono text-slate-500 truncate">{info}</p>}
        {message && <p className="text-[11px] text-slate-400 leading-tight">{message}</p>}
      </div>
      <div className="pt-0.5 shrink-0">
        {getIcon()}
      </div>
    </div>
  );
}

function LoaderSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3 w-full">
      <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
      <p className="text-xs text-slate-400">Querying database, endpoints and config...</p>
    </div>
  );
}
