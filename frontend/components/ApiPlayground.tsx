'use client';

import { useState } from 'react';
import { Play, Loader2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface FieldSchema {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

interface ApiPlaygroundProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  bodySchema?: FieldSchema[];
  queryParams?: FieldSchema[];
}

export default function ApiPlayground({ method, path, bodySchema, queryParams }: ApiPlaygroundProps) {
  const [apiKey, setApiKey] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const execute = async () => {
    if (!apiKey) {
      toast.error('Informe sua API Key');
      return;
    }

    setLoading(true);
    setResponse(null);
    setStatusCode(null);
    const start = Date.now();

    // Build URL with path params replaced and query params
    let url = `https://api.mockmail.dev/api${path}`;
    // Replace path params like :id
    for (const [k, v] of Object.entries(params)) {
      if (url.includes(`:${k}`)) {
        url = url.replace(`:${k}`, encodeURIComponent(v));
      }
    }
    // Add query params
    const qp = new URLSearchParams();
    if (queryParams) {
      for (const param of queryParams) {
        const val = params[param.name];
        if (val) qp.set(param.name, val);
      }
    }
    if (qp.toString()) url += `?${qp.toString()}`;

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && bodySchema) {
        const bodyObj: Record<string, any> = {};
        for (const field of bodySchema) {
          const val = body[field.name];
          if (val !== undefined && val !== '') {
            bodyObj[field.name] = field.type === 'number' ? Number(val) : val;
          }
        }
        if (Object.keys(bodyObj).length > 0) {
          fetchOptions.body = JSON.stringify(bodyObj);
        }
      }

      const res = await fetch(url, fetchOptions);
      setStatusCode(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err) {
      setResponse(`Error: ${(err as Error).message}`);
      setStatusCode(0);
    } finally {
      setDuration(Date.now() - start);
      setLoading(false);
    }
  };

  const handleCopyResponse = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract path params from path like /boxes/:id/emails
  const pathParams = (path.match(/:(\w+)/g) || []).map(p => p.slice(1));

  return (
    <div className="mt-3 border border-dashed border-purple-200 rounded-lg p-4 bg-purple-50/30 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-purple-600">
        <Play className="w-3.5 h-3.5" />
        Playground
      </div>

      {/* API Key */}
      <input
        type="text"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        placeholder="Sua API Key (mk_...)"
        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-mono"
      />

      {/* Path Params */}
      {pathParams.length > 0 && (
        <div className="space-y-1">
          {pathParams.map(p => (
            <input
              key={p}
              type="text"
              value={params[p] || ''}
              onChange={e => setParams(prev => ({ ...prev, [p]: e.target.value }))}
              placeholder={`:${p}`}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-mono"
            />
          ))}
        </div>
      )}

      {/* Query Params */}
      {queryParams && queryParams.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {queryParams.map(qp => (
            <input
              key={qp.name}
              type="text"
              value={params[qp.name] || ''}
              onChange={e => setParams(prev => ({ ...prev, [qp.name]: e.target.value }))}
              placeholder={`${qp.name}${qp.required ? ' *' : ''}`}
              title={qp.description}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-mono"
            />
          ))}
        </div>
      )}

      {/* Body Fields */}
      {bodySchema && bodySchema.length > 0 && (
        <div className="space-y-1">
          {bodySchema.map(field => (
            <input
              key={field.name}
              type={field.type === 'number' ? 'number' : 'text'}
              value={body[field.name] || ''}
              onChange={e => setBody(prev => ({ ...prev, [field.name]: e.target.value }))}
              placeholder={`${field.name}${field.required ? ' *' : ''} — ${field.description}`}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white font-mono"
            />
          ))}
        </div>
      )}

      {/* Execute */}
      <button
        onClick={execute}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#5636d1] text-white rounded-lg text-xs font-medium hover:bg-[#4a2db8] disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        {loading ? 'Executando...' : 'Executar'}
      </button>

      {/* Response */}
      {response && (
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-mono font-bold ${statusCode && statusCode < 400 ? 'text-emerald-600' : 'text-red-600'}`}>
              {statusCode}
            </span>
            {duration !== null && (
              <span className="text-xs text-gray-400">{duration}ms</span>
            )}
            <button onClick={handleCopyResponse} className="ml-auto p-1 rounded hover:bg-gray-200" title="Copiar">
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs max-h-64">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}
