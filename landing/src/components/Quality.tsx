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
              background: '#fff',
              padding: '4rem 3rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
            }}
          >
            <TrendingDown size={40} style={{ color: 'var(--lime)', marginBottom: '1.5rem' }} />
            <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem', color: 'var(--text-dark)' }}>
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
              background: 'var(--dark-green)',
              padding: '4rem 3rem',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-light)',
              boxShadow: '0 20px 40px rgba(11,29,44,0.15)'
            }}
          >
            <ShieldCheck size={40} style={{ color: 'var(--lime)', marginBottom: '1.5rem' }} />
            <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem' }}>
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
