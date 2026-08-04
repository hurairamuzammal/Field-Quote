'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
  { id: 'draft', label: 'AI Draft', content: 'Our AI reads the customer request and drafts a precise, itemized quote based on your live price book. It never invents prices—only matches your established rates.' },
  { id: 'review', label: 'Human Review', content: 'You maintain full control. Review the drafted quote, adjust items, and add the final professional touch before sending to the client.' },
  { id: 'deposit', label: 'Deposit', content: 'Customers accept via a secure, tokenized link and pay a deposit instantly via Stripe checkout. No card numbers touch your servers.' },
  { id: 'done', label: 'Completed Job', content: 'The job moves to your active board. The workflow is seamless, ensuring nothing falls through the cracks and you get paid on time.' }
];

export default function HistoryTabs() {
  const [active, setActive] = useState(tabs[0].id);

  return (
    <section className="section container">
      <h2 className="section-title">THE WORKFLOW.</h2>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              padding: '1rem 2rem',
              fontSize: 'var(--text-large)',
              fontFamily: 'var(--font-display)',
              background: active === tab.id ? 'var(--text-color)' : 'transparent',
              color: active === tab.id ? 'var(--accent-color)' : 'var(--text-color)',
              border: '2px solid var(--text-color)',
              borderRadius: '100px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ 
        minHeight: '200px', 
        background: 'var(--text-color)', 
        color: 'var(--bg-color)', 
        padding: '4rem', 
        borderRadius: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: 'var(--text-h3)', maxWidth: '900px', lineHeight: 1.4 }}
          >
            {tabs.find(t => t.id === active)?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
