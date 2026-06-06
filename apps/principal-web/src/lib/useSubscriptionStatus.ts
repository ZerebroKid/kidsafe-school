'use client';

import {useCallback, useEffect, useState} from 'react';
import {callFn} from '@zerebro/shared-firebase';

export interface SubscriptionState {
  loading: boolean;
  error: string | null;
  isActive: boolean;
  status: string | null;
  graceRemainingHours: number | null;
  manuallyActivated: boolean;
  refetch: () => void;
}

/**
 * Hook that queries the `getSubscriptionStatus` callable for the given school.
 * Returns the live subscription state for feature gating + banner rendering.
 */
export function useSubscriptionStatus(schoolId: string | null): SubscriptionState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [graceRemainingHours, setGraceRemainingHours] = useState<number | null>(null);
  const [manuallyActivated, setManuallyActivated] = useState(false);

  const fetch = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setIsActive(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await callFn<
        {schoolId: string},
        {
          isActive: boolean;
          status: string | null;
          graceRemainingHours: number | null;
          manuallyActivated: boolean;
        }
      >('getSubscriptionStatus', {schoolId});

      setIsActive(result.isActive);
      setStatus(result.status);
      setGraceRemainingHours(result.graceRemainingHours);
      setManuallyActivated(result.manuallyActivated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to check subscription';
      setError(msg);
      // On error, do NOT hard-block (let caller decide)
      setIsActive(false);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    loading,
    error,
    isActive,
    status,
    graceRemainingHours,
    manuallyActivated,
    refetch: fetch,
  };
}
