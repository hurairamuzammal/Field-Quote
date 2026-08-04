'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

function Counter({ from = 0, to, duration = 2 }: { from?: number, to: number, duration?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (inView) {
      let startTimestamp: number;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
        setCount(Math.floor(progress * (to - from) + from));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    }
  }, [inView, from, to, duration]);

  return <span ref={ref}>{count}</span>;
}

export default function Stats() {
  const stats = [
    { value: 15400, label: 'Customers Served', prefix: '+' },
    { value: 250, label: 'Highly Trained Staff', prefix: '' },
    { value: 98, label: 'Satisfaction Rate', prefix: '%' }
  ];

  return (
    <section className="section container">
      <div style={{
        padding: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        gap: '4rem',
        textAlign: 'center',
        width: '100%'
      }}>
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.2 }}
          >
            <div style={{
              fontSize: 'min(12vw, 8rem)', // Prevent massive overlap on small screens
              fontFamily: 'var(--font-marker)',
              color: 'var(--text-color)',
              fontWeight: 400,
              lineHeight: 1,
              whiteSpace: 'nowrap'
            }}>
              <Counter to={stat.value} />{stat.prefix}
            </div>
            <div style={{ fontSize: 'var(--text-large)', marginTop: '1rem', opacity: 0.8 }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
