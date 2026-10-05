import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 750;

/**
 * Animates a displayed integer toward `target` (ease-out), starting from the value
 * currently shown — so refreshes count from the old number, not from zero.
 * With `instant` (reduce motion) the target is shown immediately.
 */
export function useCountUp(target: number, instant = false) {
  const [display, setDisplay] = useState(instant ? target : 0);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    if (instant) {
      setDisplay(target);
      return;
    }
    const from = displayRef.current;
    if (from === target) return;
    const startedAt = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - startedAt) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, instant]);

  return display;
}
