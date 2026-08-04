'use client';

import { motion } from 'framer-motion';

export default function Marquee() {
  const text = "FAST QUOTES • EICR TESTING • EV CHARGERS • CONSUMER UNITS • FAULT FINDING • ELECTRICAL INSTALLATIONS • ";
  
  return (
    <div style={{
      padding: '2rem 0',
      background: 'var(--text-color)',
      color: 'var(--bg-color)',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      transform: 'rotate(-2deg) scale(1.05)',
      margin: '6rem 0',
      position: 'relative',
      zIndex: 10
    }}>
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ 
          repeat: Infinity, 
          ease: "linear", 
          duration: 20 
        }}
        style={{
          display: 'flex',
          fontSize: 'var(--text-h2)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          textTransform: 'uppercase',
          width: 'fit-content'
        }}
      >
        <span style={{ paddingRight: '1rem' }}>{text}</span>
        <span style={{ paddingRight: '1rem', color: 'var(--accent-color)' }}>{text}</span>
        <span style={{ paddingRight: '1rem' }}>{text}</span>
        <span style={{ paddingRight: '1rem', color: 'var(--accent-color)' }}>{text}</span>
      </motion.div>
    </div>
  );
}
