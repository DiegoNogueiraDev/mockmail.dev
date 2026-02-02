'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface ExpirationTimerProps {
  expiresAt: string | Date;
  onExpired?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  totalDuration?: number; // em segundos (default 24h)
}

export function ExpirationTimer({
  expiresAt,
  onExpired,
  size = 'md',
  showProgress = true,
  totalDuration = 24 * 60 * 60, // 24 horas em segundos
}: ExpirationTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  // Calcula o tempo restante
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
      return diff;
    };

    // Atualiza imediatamente
    const initialTimeLeft = calculateTimeLeft();
    setTimeLeft(initialTimeLeft);
    setIsExpired(initialTimeLeft <= 0);

    // Atualiza a cada segundo
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired, isExpired]);

  // Formata o tempo restante
  const formattedTime = useMemo(() => {
    if (timeLeft <= 0) return 'Expirada';

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    } else {
      return `${seconds}s`;
    }
  }, [timeLeft]);

  // Calcula a porcentagem restante
  const progressPercentage = useMemo(() => {
    if (timeLeft <= 0) return 0;
    return Math.min(100, (timeLeft / totalDuration) * 100);
  }, [timeLeft, totalDuration]);

  // Determina a cor baseada no tempo restante
  const colorClass = useMemo(() => {
    if (timeLeft <= 0) return 'text-gray-500';
    if (timeLeft <= 3600) return 'text-red-600'; // Menos de 1h
    if (timeLeft <= 6 * 3600) return 'text-orange-500'; // Menos de 6h
    if (timeLeft <= 12 * 3600) return 'text-yellow-500'; // Menos de 12h
    return 'text-emerald-500'; // Mais de 12h
  }, [timeLeft]);

  const progressColorClass = useMemo(() => {
    if (timeLeft <= 0) return 'bg-gray-300';
    if (timeLeft <= 3600) return 'bg-red-500';
    if (timeLeft <= 6 * 3600) return 'bg-orange-500';
    if (timeLeft <= 12 * 3600) return 'bg-yellow-500';
    return 'bg-emerald-500';
  }, [timeLeft]);

  // Tamanhos
  const sizeClasses = {
    sm: {
      container: 'text-xs',
      icon: 'w-3 h-3',
      progress: 'h-1',
    },
    md: {
      container: 'text-sm',
      icon: 'w-4 h-4',
      progress: 'h-1.5',
    },
    lg: {
      container: 'text-base',
      icon: 'w-5 h-5',
      progress: 'h-2',
    },
  };

  const sizeClass = sizeClasses[size];

  if (isExpired) {
    return (
      <div className={`flex items-center gap-1.5 ${sizeClass.container} text-gray-500`}>
        <AlertTriangle className={sizeClass.icon} />
        <span>Expirada</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-1.5 ${sizeClass.container} ${colorClass}`}>
        <Clock className={`${sizeClass.icon} ${timeLeft <= 60 ? 'animate-pulse' : ''}`} />
        <span className="font-medium tabular-nums">{formattedTime}</span>
      </div>
      
      {showProgress && (
        <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClass.progress}`}>
          <div
            className={`${sizeClass.progress} ${progressColorClass} transition-all duration-1000 ease-linear`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Versão circular do timer (para uso em cards)
export function CircularExpirationTimer({
  expiresAt,
  onExpired,
  size = 48,
  strokeWidth = 4,
}: {
  expiresAt: string | Date;
  onExpired?: () => void;
  size?: number;
  strokeWidth?: number;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const totalDuration = 24 * 60 * 60; // 24h

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      return Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired, isExpired]);

  const progressPercentage = Math.min(100, (timeLeft / totalDuration) * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progressPercentage / 100) * circumference;

  // Cor baseada no tempo
  const strokeColor = useMemo(() => {
    if (timeLeft <= 0) return '#9CA3AF'; // gray-400
    if (timeLeft <= 3600) return '#DC2626'; // red-600
    if (timeLeft <= 6 * 3600) return '#F97316'; // orange-500
    if (timeLeft <= 12 * 3600) return '#EAB308'; // yellow-500
    return '#10B981'; // emerald-500
  }, [timeLeft]);

  // Formato curto para dentro do círculo
  const shortFormat = useMemo(() => {
    if (timeLeft <= 0) return '0';
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }, [timeLeft]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-bold tabular-nums"
          style={{
            fontSize: size * 0.25,
            color: strokeColor,
          }}
        >
          {shortFormat}
        </span>
      </div>
    </div>
  );
}

export default ExpirationTimer;
