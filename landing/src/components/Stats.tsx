'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

function Counter({ to, duration = 2.5 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reducedMotion = Boolean(useReducedMotion());
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView || reducedMotion) return;

    let start: number | undefined;
    let frame = 0;
    const step = (ts: number) => {
      if (start === undefined) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.floor(eased * to));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration, reducedMotion]);

  return <span ref={ref}>{(reducedMotion ? to : count).toLocaleString()}</span>;
}

const stats = [
  { value: 7, label: 'Journey steps', suffix: '' },
  { value: 2, label: 'Payment stages', suffix: '' },
  { value: 1, label: 'Completion photo required', suffix: '' },
  { value: 20, label: 'Character private links', suffix: '+' },
];

const motionEase = [0.16, 1, 0.3, 1] as const;

export default function Stats() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section
      className="section-pad"
      style={{
        background: 'var(--lime)',
        color: 'var(--near-black)',
      }}
    >
      <div className="container">
        <div className="grid-2x2" style={{ textAlign: 'center', gap: '3rem' }}>
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
              whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: reducedMotion ? 0 : 0.5,
                delay: reducedMotion ? 0 : i * 0.1,
                ease: motionEase,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(3rem, 8vw, 5.5rem)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  color: 'var(--near-black)',
                }}
              >
                <Counter to={stat.value} />
                <span style={{ fontSize: '0.5em', opacity: 0.7 }}>{stat.suffix}</span>
              </div>
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  marginTop: '0.5rem',
                  opacity: 0.85,
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
