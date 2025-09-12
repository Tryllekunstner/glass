'use client';

import React from 'react';
import { useClientOnly } from '../hooks/useClientOnly';

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component wrapper that only renders children on the client side after hydration.
 * This prevents SSR/CSR mismatches by ensuring client-only code runs at the right time.
 * 
 * @param children - Content to render only on client side
 * @param fallback - Optional content to show during server-side rendering
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const { isHydrated } = useClientOnly();

  if (!isHydrated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
