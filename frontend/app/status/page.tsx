'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'checking';
  responseTime?: number;
}

export default function StatusPage() {
  const [components, setComponents] = useState<ComponentStatus[]>([
    { name: 'API', status: 'checking' },
    { name: 'Frontend', status: 'checking' },
    { name: 'Email Processor', status: 'checking' },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    const results: ComponentStatus[] = [];

    // Check API
    try {
      const start = Date.now();
      const res = await fetch('https://api.mockmail.dev/api/health', { signal: AbortSignal.timeout(5000) });
      const time = Date.now() - start;
      results.push({
        name: 'API',
        status: res.ok ? 'operational' : 'degraded',
        responseTime: time,
      });
    } catch {
      results.push({ name: 'API', status: 'down' });
    }

    // Check Frontend
    try {
      const start = Date.now();
      const res = await fetch('https://mockmail.dev/', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const time = Date.now() - start;
      results.push({
        name: 'Frontend',
        status: res.ok ? 'operational' : 'degraded',
        responseTime: time,
      });
    } catch {
      results.push({ name: 'Frontend', status: 'down' });
    }

    // Email processor status inferred from API health
    const apiStatus = results.find(r => r.name === 'API');
    results.push({
      name: 'Email Processor',
      status: apiStatus?.status === 'operational' ? 'operational' : 'degraded',
    });

    setComponents(results);
    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const overallStatus = components.some(c => c.status === 'down')
    ? 'down'
    : components.some(c => c.status === 'degraded')
    ? 'degraded'
    : components.every(c => c.status === 'operational')
    ? 'operational'
    : 'checking';

  const statusConfig = {
    operational: { label: 'All Systems Operational', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
    degraded: { label: 'Partial Outage', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
    down: { label: 'Major Outage', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
    checking: { label: 'Checking...', color: 'bg-gray-400', textColor: 'text-gray-600', bgColor: 'bg-gray-50' },
  };

  const config = statusConfig[overallStatus];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
              >
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Status</h1>
                <p className="text-sm text-gray-500">MockMail.dev System Status</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Overall Status Banner */}
        <div className={`rounded-xl p-6 ${config.bgColor} border`}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${config.color} ${overallStatus === 'checking' ? 'animate-pulse' : ''}`} />
            <h2 className={`text-lg font-bold ${config.textColor}`}>{config.label}</h2>
          </div>
          {lastChecked && (
            <p className="text-sm text-gray-500 mt-2">
              Last checked: {lastChecked.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
            </p>
          )}
        </div>

        {/* Components */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {components.map(comp => (
            <div key={comp.name} className="flex items-center justify-between p-4">
              <span className="font-medium text-gray-900">{comp.name}</span>
              <div className="flex items-center gap-3">
                {comp.responseTime !== undefined && (
                  <span className="text-xs text-gray-400">{comp.responseTime}ms</span>
                )}
                {comp.status === 'operational' && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Operational
                  </span>
                )}
                {comp.status === 'degraded' && (
                  <span className="flex items-center gap-1 text-sm text-amber-600">
                    <AlertTriangle className="w-4 h-4" /> Degraded
                  </span>
                )}
                {comp.status === 'down' && (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <XCircle className="w-4 h-4" /> Down
                  </span>
                )}
                {comp.status === 'checking' && (
                  <span className="flex items-center gap-1 text-sm text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Checking
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Refresh Button */}
        <div className="text-center">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Verificando...' : 'Verificar Novamente'}
          </button>
        </div>

        {/* Info */}
        <div className="text-center text-sm text-gray-500">
          <p>
            This page checks the availability of MockMail.dev services in real-time.
          </p>
          <p className="mt-1">
            <Link href="/" className="text-[#5636d1] hover:underline">Back to MockMail.dev</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
