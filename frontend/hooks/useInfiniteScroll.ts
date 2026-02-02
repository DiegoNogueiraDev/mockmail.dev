import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInfiniteScrollOptions {
  /** Threshold em pixels antes do final da lista para acionar o carregamento */
  threshold?: number;
  /** Se true, desabilita o infinite scroll */
  disabled?: boolean;
  /** Root element para o observer (null = viewport) */
  root?: Element | null;
}

interface UseInfiniteScrollReturn {
  /** Ref para o elemento sentinela que deve ser colocado no final da lista */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Indica se está carregando mais itens */
  isLoadingMore: boolean;
  /** Reseta o estado para permitir novos carregamentos */
  reset: () => void;
}

/**
 * Hook para implementar infinite scroll usando Intersection Observer
 * 
 * @example
 * ```tsx
 * const { sentinelRef, isLoadingMore } = useInfiniteScroll({
 *   onLoadMore: () => fetchNextPage(),
 *   hasMore: page < totalPages,
 * });
 * 
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *     <div ref={sentinelRef} />
 *     {isLoadingMore && <Spinner />}
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll(
  onLoadMore: () => Promise<void> | void,
  hasMore: boolean,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const { threshold = 100, disabled = false, root = null } = options;
  
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingRef = useRef(false);

  const reset = useCallback(() => {
    loadingRef.current = false;
    setIsLoadingMore(false);
  }, []);

  const handleIntersect = useCallback(
    async (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      if (
        entry.isIntersecting &&
        hasMore &&
        !loadingRef.current &&
        !disabled
      ) {
        loadingRef.current = true;
        setIsLoadingMore(true);
        
        try {
          await onLoadMore();
        } finally {
          loadingRef.current = false;
          setIsLoadingMore(false);
        }
      }
    },
    [onLoadMore, hasMore, disabled]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || disabled) return;

    const observer = new IntersectionObserver(handleIntersect, {
      root,
      rootMargin: `${threshold}px`,
      threshold: 0,
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersect, threshold, root, disabled]);

  return {
    sentinelRef,
    isLoadingMore,
    reset,
  };
}

export default useInfiniteScroll;
