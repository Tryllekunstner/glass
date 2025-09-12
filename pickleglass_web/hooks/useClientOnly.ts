import { useState, useEffect } from 'react';

interface UseClientOnlyReturn {
  isClient: boolean;
  isHydrated: boolean;
}

/**
 * Custom hook to detect client-side rendering state and hydration completion.
 * This hook helps prevent SSR/CSR mismatches by providing reliable client-side detection.
 * 
 * @returns Object containing isClient and isHydrated boolean flags
 */
export function useClientOnly(): UseClientOnlyReturn {
  const [isClient, setIsClient] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // This effect only runs on the client side
    setIsClient(true);
    
    // Use a small delay to ensure hydration is complete
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return {
    isClient,
    isHydrated
  };
}
