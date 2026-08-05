'use client';

import { motion } from 'framer-motion';
import { Brain, Shield, Lock, CreditCard } from 'lucide-react';
import HoverSpotlight from './HoverSpotlight';

const features = [
  {
    icon: Brain,
    title: 'CONTROLLED\nAI',
    desc: 'The AI never invents a price. Every line item references your live price book. Unmatched work flags for manual review — zero hallucinations.'
  },
  {
    icon: Shield,
    title: 'IDEMPOTENT\nSECURITY',
    desc: 'Money state changes only through signature-verified Stripe webhooks. Replays are no-ops. Payment logic is tamper-proof by design.'
  },
  {
    icon: Lock,
    title: 'TOKENIZED\nPRIVACY',
    desc: 'Customers interact via secure 20+ char hashed links. Expired or declined quotes instantly revoke access. No raw IDs ever exposed.'
  },
  {
    icon: CreditCard,
    title: 'AUTO\nOPERATIONS',
    desc: 'Stripe handles hosted checkout with split deposits. Make.com issues instant automated receipts on job completion. Zero manual steps.'
  }
];

export default function About() {
  return (
    <section id="about" className="section-pad-lg" style={{ background: 'var(--cream)' }}>
      <div className="container">
        <div className="section-label">The Standard</div>
        <h2 className="section-heading">BUILT DIFFERENT.</h2>

        <p style={{ fontSize: 'var(--text-h3)', lineHeight: 1.4, maxWidth: '700px', marginBottom: 'var(--space-xl)', fontWeight: 500 }}>
          FieldQuote isn&apos;t another quoting tool. It&apos;s an operational system where speed meets absolute security.
        </p>

        <HoverSpotlight className="grid-2x2 glow-wrapper">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="glow-card"
              style={{
                padding: '3.5rem 2.5rem',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--lime)',
                color: 'var(--dark-green)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 10px 30px rgba(0,224,196,0.15)'
              }}
            >
              <f.icon size={44} strokeWidth={2} color="var(--dark-green)" />
              <h3 style={{ fontFamily: 'var(--font-marker)', fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', lineHeight: 1.1, color: 'var(--dark-green)', fontWeight: 'normal', letterSpacing: '0.05em', whiteSpace: 'pre-line' }}>{f.title}</h3>
              <p style={{ fontSize: 'var(--text-large)', opacity: 0.9, fontWeight: 500, lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </HoverSpotlight>
      </div>
    </section>
  );
}
