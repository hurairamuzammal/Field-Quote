'use client';

import { motion } from 'framer-motion';
import { Shield, Brain, CreditCard, Lock } from 'lucide-react';

const standards = [
  {
    icon: Brain,
    title: 'Controlled AI Generation',
    desc: 'The AI never invents a price. Every line item strictly references your live price-book. Unmatched work requires manual admin review. Absolute control, zero hallucinations.'
  },
  {
    icon: Shield,
    title: 'Idempotent Security',
    desc: 'Money state changes exclusively through signature-verified, idempotent Stripe webhooks. Bubble workflows never touch payment states.'
  },
  {
    icon: Lock,
    title: 'Tokenized Privacy',
    desc: 'Customers interact purely through secure, tokenized links (≥20-char random hashes). Expired or declined quotes instantly lock out access.'
  },
  {
    icon: CreditCard,
    title: 'Automated Operations',
    desc: 'Stripe handles the hosted checkout and split deposits, while Make.com automates the instant issuance of secure receipts upon job completion.'
  }
];

export default function About() {
  return (
    <section id="about" className="section container" style={{ paddingBottom: '8rem' }}>
      <h2 className="section-title">THE STANDARD.</h2>
      
      <div style={{ maxWidth: '800px', marginBottom: '4rem' }}>
        <p style={{ fontSize: 'var(--text-h3)', lineHeight: 1.4, opacity: 0.9 }}>
          FieldQuote isn't just a quoting tool. It's a high-end operational flow built for independent teams. We stripped away the bloat and engineered a system where speed meets absolute security.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '2rem' }}>
        {standards.map((std, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              background: 'var(--card-bg)',
              color: '#121514',
              padding: '3rem',
              borderRadius: '24px',
              border: '1px solid rgba(0,0,0,0.1)'
            }}
          >
            <std.icon size={48} strokeWidth={1.5} style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }} />
            <h3 style={{ fontSize: 'var(--text-large)', fontWeight: 800, marginBottom: '1rem' }}>{std.title}</h3>
            <p style={{ fontSize: 'var(--text-base)', opacity: 0.8, lineHeight: 1.6 }}>{std.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
