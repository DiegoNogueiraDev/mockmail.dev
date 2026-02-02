import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { EmailStatus } from '@/types/email';

interface SearchOptions {
  startDate?: string;
  endDate?: string;
  days?: number;
  limit?: number;
  page?: number;
}

interface UseEmailTrackingReturn {
  data: EmailStatus[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  searchEmail: (email: string, options?: SearchOptions) => Promise<void>;
  clearData: () => void;
}

const useEmailTracking = (): UseEmailTrackingReturn => {
  const [data, setData] = useState<EmailStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const searchEmail = useCallback(async (email: string, options: SearchOptions = {}) => {
    if (!email.trim()) {
      toast.error('Por favor, insira um endereço de email válido');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        email: email.trim(),
        limit: (options.limit || 20).toString(),
        page: (options.page || 1).toString(),
      });

      // Add date filters
      if (options.startDate) {
        params.append('startDate', options.startDate);
      }
      
      if (options.endDate) {
        params.append('endDate', options.endDate);
      }
      
      if (options.days && !options.startDate && !options.endDate) {
        params.append('days', options.days.toString());
      }

      const response = await fetch(`/api/track?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar emails');
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data || []);
        setTotal(result.pagination?.total || 0);
        setPage(result.pagination?.page || 1);
        setTotalPages(result.pagination?.totalPages || 0);
        
        if (result.data?.length === 0) {
          if (options.page && options.page > 1) {
            toast('Nenhum email encontrado nesta página', {
              icon: 'ℹ️',
              duration: 3000,
            });
          } else {
            toast('Nenhum email encontrado para os critérios especificados', {
              icon: 'ℹ️',
              duration: 3000,
            });
          }
        } else {
          const emailCount = result.data?.length || 0;
          const totalCount = result.pagination?.total || 0;
          
          if (options.page && options.page > 1) {
            toast.success(`Carregada página ${result.pagination?.page || 1} com ${emailCount} emails`);
          } else {
            toast.success(`${emailCount} email${emailCount !== 1 ? 's' : ''} encontrado${emailCount !== 1 ? 's' : ''} (${totalCount} total)`);
          }
        }
      } else {
        throw new Error(result.error || 'Erro inesperado ao buscar emails');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Error fetching email tracking data:', err);
      
      setError(errorMessage);
      setData([]);
      setTotal(0);
      setPage(1);
      setTotalPages(0);
      
      // Show more specific error messages
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('fetch')) {
        toast.error('Erro de conexão com o servidor de tracking');
      } else if (errorMessage.includes('404')) {
        toast.error('Serviço de tracking não encontrado');
      } else if (errorMessage.includes('500')) {
        toast.error('Erro interno do servidor de tracking');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData([]);
    setError(null);
    setTotal(0);
    setPage(1);
    setTotalPages(0);
  }, []);

  return {
    data,
    loading,
    error,
    total,
    page,
    totalPages,
    searchEmail,
    clearData,
  };
};

export default useEmailTracking;
