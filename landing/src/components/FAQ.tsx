'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    q: 'How accurate is the AI quoting?',
    a: 'The AI strictly references your live price book — it never invents or estimates a price. Every line item maps to a real entry. Unmatched work is flagged for manual admin review before the quote is sent.'
  },
  {
    q: 'Is my payment information secure?',
    a: 'Absolutely. We never handle card details directly. All payments run through Stripe\'s PCI-compliant hosted checkout. Payment state changes only happen via signature-verified, idempotent webhooks — never from client-side code.'
  },
  {
    q: 'How do customers access their quotes?',
    a: 'Customers receive secure, tokenized links with 20+ character random hashes. These links are resolved server-side and automatically expire when a quote is declined or completed. No raw database IDs are ever exposed.'
  },
  {
    q: 'What certifications does your team hold?',
    a: 'All technicians are NICEIC Approved Contractors and TrustMark Registered. Our operations are ISO 9001:2015 certified. Every team member is background-checked and continuously trained.'
  },
  {
    q: 'Can I integrate FieldQuote with my existing systems?',
    a: 'FieldQuote is built on open standards — Supabase (PostgreSQL), Stripe, and Make.com webhooks. Our admin portal runs on Bubble with a clean API connector. Custom integrations are available for enterprise clients.'
  },
  {
    q: 'What does the free tier include?',
    a: 'We operate entirely on free tiers — Supabase, Vercel, Make.com, and Cloudflare R2. You only pay Stripe\'s standard processing fees on actual transactions. No monthly subscription, no hidden costs.'
  },
  {
    q: 'How fast are quotes typically generated?',
    a: 'From the moment a customer submits their request, the AI draft is generated in under 30 seconds. Admin review and sending typically takes under 4 minutes. Customers often receive their quote before they\'ve finished their coffee.'
  },
  {
    q: 'Do you handle follow-up communications?',
    a: 'Yes, but responsibly. The system caps follow-up emails at 2 per quote and 2 per invoice. Every outbound email is logged to our email_log table. We never spam — the cap is enforced at the database level, not just in code.'
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="section-pad-lg" style={{ background: 'var(--dark-green)', color: 'var(--text-light)' }}>
      <div className="container">
        <div className="section-label" style={{ color: 'var(--lime)' }}>FAQ</div>
        <h2 className="section-heading">GOT QUESTIONS?</h2>

        <div style={{ maxWidth: '800px' }}>
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{
                  borderBottom: '1px solid var(--border-dark)',
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.5rem 0',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-light)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 'var(--text-large)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    gap: '1rem'
                  }}
                >
                  {faq.q}
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ flexShrink: 0 }}
                  >
                    <ChevronDown size={22} color="var(--lime)" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p style={{
                        fontSize: 'var(--text-base)',
                        lineHeight: 1.7,
                        opacity: 0.75,
                        paddingBottom: '1.5rem',
                        maxWidth: '650px'
                      }}>
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
