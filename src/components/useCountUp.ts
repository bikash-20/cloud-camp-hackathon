import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Animates a number from 0 → target using rAF. Honors prefers-reduced-motion
 * by snapping straight to the final value.
 */
export default function useCountUp(target: number, { duration = 800, decimals = 0 }: { duration?: number; decimals?: number } = {}): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const fromRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }
    fromRef.current = 0;
    startRef.current = performance.now();
    const factor = Math.pow(10, decimals);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setValue(Math.round(current * factor) / factor);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals, reduceMotion]);

  return value;
}