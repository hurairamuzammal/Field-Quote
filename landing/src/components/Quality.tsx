'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, TrendingDown } from 'lucide-react';

export default function Quality() {
  return (
    <section className="section-pad" style={{ background: 'var(--cream)' }}>
      <div className="container">
        <div className="grid-2x2">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              padding: '4rem 3rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255,255,255,0.8)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)'
            }}
          >
            <TrendingDown size={44} style={{ color: 'var(--lime)', marginBottom: '1.5rem' }} />
            <h3 style={{ fontFamily: 'var(--font-marker)', fontSize: 'clamp(2rem, 3vw, 2.5rem)', marginBottom: '1rem', color: 'var(--text-dark)', fontWeight: 'normal', letterSpacing: '0.05em' }}>
              FAIR, MARKET-BEATING PRICES
            </h3>
            <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.6 }}>
              We believe in transparency. Because our AI handles the quoting overhead, we pass those administrative savings directly to you. You get premium electrical services at prices that consistently beat the local market average, without hidden fees.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            style={{
              background: 'rgba(11, 29, 44, 0.85)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              padding: '4rem 3rem',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-light)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)'
            }}
          >
            <ShieldCheck size={44} style={{ color: 'var(--lime)', marginBottom: '1.5rem' }} />
            <h3 style={{ fontFamily: 'var(--font-marker)', fontSize: 'clamp(2rem, 3vw, 2.5rem)', marginBottom: '1rem', fontWeight: 'normal', letterSpacing: '0.05em' }}>
              STRICT QUALITY PROTOCOLS
            </h3>
            <p style={{ fontSize: 'var(--text-base)', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              Lower prices never mean cutting corners. Every job is executed under strict NICEIC-approved quality protocols. From routine maintenance to full structural rewiring, our certified technicians guarantee safety, durability, and a flawless finish.
            </p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
