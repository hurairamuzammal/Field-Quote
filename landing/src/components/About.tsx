'use client';

import { motion } from 'framer-motion';
import { Brain, Shield, Lock, CreditCard } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Controlled AI',
    desc: 'The AI never invents a price. Every line item references your live price book. Unmatched work flags for manual review — zero hallucinations.'
  },
  {
    icon: Shield,
    title: 'Idempotent Security',
    desc: 'Money state changes only through signature-verified Stripe webhooks. Replays are no-ops. Payment logic is tamper-proof by design.'
  },
  {
    icon: Lock,
    title: 'Tokenized Privacy',
    desc: 'Customers interact via secure 20+ char hashed links. Expired or declined quotes instantly revoke access. No raw IDs ever exposed.'
  },
  {
    icon: CreditCard,
    title: 'Auto Operations',
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

        <div className="grid-2x2">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              style={{
                padding: '3.5rem 2.5rem',
                background: '#fff',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <f.icon size={32} strokeWidth={1.5} color="var(--dark-green)" />
              <h3 style={{ fontSize: 'var(--text-large)', fontWeight: 800 }}>{f.title}</h3>
              <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
