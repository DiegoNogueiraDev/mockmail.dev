'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/apiClient';
import { Mail, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface RecentEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  boxAddress: string;
}

interface RecentEmailsCardProps {
  /** Maximum number of emails to display */
  limit?: number;
  /** Callback when emails are loaded */
  onLoad?: (emails: RecentEmail[]) => void;
}

export default function RecentEmailsCard({ limit = 5, onLoad }: RecentEmailsCardProps) {
  const [emails, setEmails] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchEmails = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<RecentEmail[]>(`/api/dashboard/recent-emails?limit=${limit}`);

      if (response.success && response.data) {
        setEmails(response.data);
        onLoad?.(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch recent emails:', err);
      setError('Erro ao carregar emails');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // Load when component becomes visible and hasn't loaded yet
        if (entry.isIntersecting && !hasLoaded && !loading) {
          fetchEmails();
        }
      },
      {
        root: null, // viewport
        rootMargin: '100px', // Start loading 100px before visible
        threshold: 0.1, // Trigger when 10% visible
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded, loading]);

  // Skeleton loading state
  const renderSkeleton = () => (
    <>
      {Array.from({ length: limit }).map((_, i) => (
        <div key={i} className="p-4 flex gap-4 animate-pulse">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="w-48 h-4 bg-gray-200 rounded" />
            <div className="w-32 h-3 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </>
  );

  // Empty state
  const renderEmpty = () => (
    <div className="empty-state py-12">
      <Mail className="empty-state-icon" />
      <p className="empty-state-title">Nenhum email ainda</p>
      <p className="empty-state-description">
        Os emails recebidos aparecerão aqui
      </p>
    </div>
  );

  // Error state
  const renderError = () => (
    <div className="p-6 text-center">
      <p className="text-sm text-red-600 mb-3">{error}</p>
      <button
        onClick={fetchEmails}
        className="text-sm font-medium text-[#5636d1] hover:underline flex items-center gap-1 mx-auto"
      >
        <RefreshCw className="w-4 h-4" />
        Tentar novamente
      </button>
    </div>
  );

  // Email list
  const renderEmails = () => (
    <>
      {emails.map((email) => (
        <Link
          key={email.id}
          href={`/admin/emails/${email.id}`}
          className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
          data-testid={`email-item-${email.id}`}
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {email.subject || '(Sem assunto)'}
            </p>
            <p className="text-sm text-gray-500 truncate">
              De: {email.from}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge-brand-purple text-xs">
                {email.boxAddress}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(email.receivedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </>
  );

  return (
    <div
      ref={cardRef}
      className="lg:col-span-2 card-brand"
      data-testid="recent-emails-card"
    >
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Emails Recentes</h2>
            {loading && hasLoaded && (
              <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-3">
            {hasLoaded && !loading && (
              <button
                onClick={fetchEmails}
                className="text-sm text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <Link
              href="/admin/emails"
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--mockmail-purple)' }}
            >
              Ver todos
            </Link>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {loading && !hasLoaded && renderSkeleton()}
        {error && renderError()}
        {hasLoaded && !loading && !error && emails.length === 0 && renderEmpty()}
        {hasLoaded && !error && emails.length > 0 && renderEmails()}
      </div>
    </div>
  );
}
