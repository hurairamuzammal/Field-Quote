'use client';

import { motion } from 'framer-motion';

const items = [
  'AI-Powered Quoting',
  '•',
  'Stripe Payments',
  '•',
  'Real-Time Tracking',
  '•',
  'Automated Receipts',
  '•',
  'NICEIC Approved',
  '•',
  'Price Book Control',
  '•',
];

export default function Marquee() {
  const doubled = [...items, ...items, ...items, ...items, ...items];

  return (
    <div style={{ 
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--cream)',
      padding: '10rem 0', // Give it massive vertical space to handle the steep diagonal
      zIndex: 10
    }}>
      {/* Flawless diagonal dark green split below the ribbon */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '-50vw',
        width: '200vw',
        height: '2000px',
        background: 'var(--dark-green)',
        transform: 'rotate(-4deg)',
        transformOrigin: 'top center',
        zIndex: 1
      }} />

      {/* The actual ribbon */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '-50vw',
        width: '200vw',
        transform: 'translateY(-50%) rotate(-4deg)',
        background: 'var(--lime)',
        padding: '2.5rem 0',
        zIndex: 2,
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        <motion.div
          animate={{ x: ['0%', '-20%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{
            display: 'flex',
            gap: '3rem',
            whiteSpace: 'nowrap',
            width: 'max-content',
            paddingLeft: '50vw' // Counteract the -50vw positioning so text starts on screen
          }}
        >
          {doubled.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: item === '•' ? 400 : 800,
                fontSize: item === '•' ? '1.5rem' : 'var(--text-large)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#000',
                opacity: item === '•' ? 0.4 : 1
              }}
            >
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
