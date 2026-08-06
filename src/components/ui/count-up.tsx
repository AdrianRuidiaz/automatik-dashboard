"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

// Anima un numero desde su valor anterior hasta el nuevo cada vez que
// cambia (carga inicial o refresco del dashboard), en vez de aparecer de
// golpe. Usa requestAnimationFrame con easing, no setInterval, para que se
// vea fluido. En el ultimo frame fija el valor exacto (sin restos de punto
// flotante) para que el numero final sea identico al que se habria
// mostrado sin animacion.
export function CountUp({ value, duration = 700, format = (n) => String(Math.round(n)), className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (from === to) { setDisplay(to); return; }

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      if (t >= 1) {
        setDisplay(to);
        fromRef.current = to;
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
