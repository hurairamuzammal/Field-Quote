'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

function Counter({ to, duration = 2.5 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.floor(eased * to));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, to, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

const stats = [
  { value: 15400, label: 'Customers Served', suffix: '+' },
  { value: 250, label: 'Trained Technicians', suffix: '' },
  { value: 98, label: 'Satisfaction Rate', suffix: '%' },
  { value: 4, label: 'Minute Avg. Quote', suffix: 'min' },
];

export default function Stats() {
  return (
    <section className="section-pad" style={{
      background: 'var(--lime)',
      color: '#000'
    }}>
      <div className="container">
        <div className="grid-2x2" style={{ textAlign: 'center', gap: '3rem' }}>
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div style={{
                fontSize: 'clamp(3rem, 8vw, 5.5rem)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                color: '#000'
              }}>
                <Counter to={stat.value} />
                <span style={{ fontSize: '0.5em', opacity: 0.7 }}>{stat.suffix}</span>
              </div>
              <div style={{
                fontSize: 'var(--text-base)',
                marginTop: '0.5rem',
                opacity: 0.85,
                fontWeight: 600
              }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
