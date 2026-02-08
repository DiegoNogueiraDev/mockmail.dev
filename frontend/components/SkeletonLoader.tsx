'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

/**
 * Skeleton for email box list item - mimics the actual layout
 */
export function SkeletonBoxItem() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
      {/* Timer/Icon circular */}
      <div className="w-12 h-12 skeleton rounded-xl flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-48 h-5 skeleton" />
          <div className="w-6 h-6 skeleton rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-4 skeleton" />
          <div className="w-24 h-4 skeleton" />
          <div className="w-16 h-4 skeleton" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <div className="w-20 h-9 skeleton rounded-2xl" />
        <div className="w-20 h-9 skeleton rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Skeleton for email list item
 */
export function SkeletonEmailItem() {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-gray-100 last:border-0">
      {/* Avatar */}
      <div className="w-10 h-10 skeleton rounded-full flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="w-3/4 h-5 skeleton" />
        <div className="w-1/2 h-4 skeleton" />
        <div className="w-24 h-3 skeleton" />
      </div>
    </div>
  );
}

/**
 * Skeleton for box header/detail view
 */
export function SkeletonBoxHeader() {
  return (
    <div className="card-brand p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon */}
        <div className="w-14 h-14 skeleton rounded-2xl flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="w-64 h-6 skeleton" />
          <div className="flex items-center gap-4">
            <div className="w-24 h-4 skeleton" />
            <div className="w-32 h-4 skeleton" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <div className="w-24 h-10 skeleton rounded-2xl" />
          <div className="w-24 h-10 skeleton rounded-2xl" />
          <div className="w-24 h-10 skeleton rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton list for boxes - shows multiple box items
 */
export function SkeletonBoxesList({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBoxItem key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton list for emails - shows multiple email items
 */
export function SkeletonEmailsList({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonEmailItem key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for loading more indicator (infinite scroll)
 */
export function SkeletonLoadingMore() {
  return (
    <div className="flex items-center justify-center py-6 gap-3">
      <div className="flex gap-1">
        <div className="w-2 h-2 skeleton rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 skeleton rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 skeleton rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-gray-500">Carregando...</span>
    </div>
  );
}

/**
 * Skeleton for summary cards (stats)
 */
export function SkeletonStatsCard() {
  return (
    <div className="card-brand p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 skeleton rounded-xl" />
        <div className="space-y-2">
          <div className="w-20 h-4 skeleton" />
          <div className="w-12 h-6 skeleton" />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
