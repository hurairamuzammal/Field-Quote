'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Brain, Shield, Lock, CreditCard } from 'lucide-react';
import HoverSpotlight from './HoverSpotlight';

const features = [
  {
    icon: Brain,
    title: 'CONTROLLED\nAI',
    desc: 'The AI never invents a price. Every line item references your live price book. Unmatched work flags for manual review — zero hallucinations.',
  },
  {
    icon: Shield,
    title: 'IDEMPOTENT\nSECURITY',
    desc: 'Money state changes only through signature-verified Stripe webhooks. Replays are no-ops. Payment logic is tamper-proof by design.',
  },
  {
    icon: Lock,
    title: 'TOKENIZED\nPRIVACY',
    desc: 'Customers interact via secure 20+ char hashed links. Expired or declined quotes instantly revoke access. No raw IDs ever exposed.',
  },
  {
    icon: CreditCard,
    title: 'AUTO\nOPERATIONS',
    desc: 'Stripe-hosted Checkout collects a deposit after quote acceptance, then a final invoice when the job is complete. Every payment is logged — no card fields in the app.',
  },
];

const motionEase = [0.16, 1, 0.3, 1] as const;

export default function About() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section id="about" className="section-pad-lg">
      <div className="container">
        <div className="section-label">The standard</div>
        <h2 className="section-heading">THE JOB STAYS ON RECORD.</h2>

        <p
          style={{
            fontSize: 'var(--text-h3)',
            lineHeight: 1.4,
            maxWidth: '700px',
            marginBottom: 'var(--space-xl)',
            fontWeight: 500,
          }}
        >
          Quotes, payments, and visits share one job record. Speed does not mean an invented
          price, a missing photo, or a public customer link.
        </p>

        <HoverSpotlight className="grid-2x2 glow-wrapper">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={reducedMotion ? false : { opacity: 0, y: 30 }}
              whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: reducedMotion ? 0 : 0.5,
                delay: reducedMotion ? 0 : i * 0.08,
                ease: motionEase,
              }}
              whileHover={reducedMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
              className="glow-card"
              style={{
                padding: '3.5rem 2.5rem',
                border: '1px solid rgba(11, 29, 44, 0.12)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--lime)',
                color: 'var(--dark-green)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 10px 30px rgba(0,224,196,0.15)',
              }}
            >
              <f.icon size={44} strokeWidth={2} color="var(--dark-green)" />
              <h3
                style={{
                  fontFamily: 'var(--font-marker-face)',
                  fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
                  lineHeight: 1.1,
                  color: 'var(--dark-green)',
                  fontWeight: 'normal',
                  letterSpacing: '0.05em',
                  whiteSpace: 'pre-line',
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 'var(--text-large)',
                  opacity: 0.9,
                  fontWeight: 500,
                  lineHeight: 1.6,
                }}
              >
                {f.desc}
              </p>
            </motion.div>
          ))}
        </HoverSpotlight>
      </div>
    </section>
  );
}
