"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a deferred loading state that:
 * 1. Only becomes true after `delay` ms (avoids flicker on fast loads)
 * 2. Once shown, stays true for at least `minDuration` ms (avoids jarring on/off)
 *
 * @param isLoading - The actual loading state from your query/mutation
 * @param delay - Ms to wait before showing loading (default: 200ms)
 * @param minDuration - Min ms to show loading once visible (default: 300ms)
 */
export function useDeferredLoading(
  isLoading: boolean,
  delay = 200,
  minDuration = 300,
): boolean {
  const [showLoading, setShowLoading] = useState(false);
  const showTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let minDurationTimer: ReturnType<typeof setTimeout> | null = null;

    if (isLoading) {
      // Start delay timer - only show loading after delay
      delayTimer = setTimeout(() => {
        setShowLoading(true);
        showTimeRef.current = Date.now();
      }, delay);
    } else {
      // Loading finished
      if (showTimeRef.current !== null) {
        // Loading indicator was shown - ensure minimum display time
        const elapsed = Date.now() - showTimeRef.current;
        const remaining = minDuration - elapsed;

        if (remaining > 0) {
          minDurationTimer = setTimeout(() => {
            setShowLoading(false);
            showTimeRef.current = null;
          }, remaining);
        } else {
          setShowLoading(false);
          showTimeRef.current = null;
        }
      } else {
        // Loading finished before delay - never show indicator
        setShowLoading(false);
      }
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (minDurationTimer) clearTimeout(minDurationTimer);
    };
  }, [isLoading, delay, minDuration]);

  return showLoading;
}
