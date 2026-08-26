'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ClipboardCheck } from 'lucide-react';

const motionEase = [0.16, 1, 0.3, 1] as const;

export default function Quality() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section className="section-pad" style={{ background: 'var(--cream)' }}>
      <div className="container">
        <div className="grid-2x2">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 30 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: motionEase }}
            className="glass-card"
            style={{
              padding: '4rem 3rem',
            }}
          >
            <ClipboardCheck size={44} style={{ color: 'var(--lime)', marginBottom: '1.5rem' }} />
            <h3
              style={{
                fontFamily: 'var(--font-marker-face)',
                fontSize: 'clamp(2rem, 3vw, 2.5rem)',
                marginBottom: '1rem',
                color: 'var(--text-dark)',
                fontWeight: 'normal',
                letterSpacing: '0.05em',
              }}
            >
              REVIEWED QUOTES
            </h3>
            <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.6 }}>
              Every quote is drafted against your live price book, then reviewed before it goes out.
              Matched line items carry stored prices; unmatched work stays flagged until a human
              sets the scope. Customers see the agreed total — not a guess from the model.
            </p>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 30 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: reducedMotion ? 0 : 0.5,
              delay: reducedMotion ? 0 : 0.15,
              ease: motionEase,
            }}
            style={{
              background: 'rgba(11, 29, 44, 0.85)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              padding: '4rem 3rem',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-light)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow:
                '0 10px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <ShieldCheck size={44} style={{ color: 'var(--lime)', marginBottom: '1.5rem' }} />
            <h3
              style={{
                fontFamily: 'var(--font-marker-face)',
                fontSize: 'clamp(2rem, 3vw, 2.5rem)',
                marginBottom: '1rem',
                fontWeight: 'normal',
                letterSpacing: '0.05em',
              }}
            >
              DOCUMENTED CLOSE-OUT
            </h3>
            <p style={{ fontSize: 'var(--text-base)', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              Jobs finish with completion notes and at least one on-site photo attached to the
              record. Deposit and final balance each run through Stripe-hosted Checkout, with
              payment status written back before the workflow advances.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
