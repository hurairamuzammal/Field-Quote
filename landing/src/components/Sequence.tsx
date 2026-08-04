'use client';

import { motion } from 'framer-motion';
import { Mic, Bot, UserCheck, CreditCard } from 'lucide-react';
import { useState } from 'react';

const steps = [
  {
    num: '1',
    icon: Mic,
    title: 'Query & Dictation',
    desc: 'User writes their query via text or dictates it directly. Our system instantly captures the intent.'
  },
  {
    num: '2',
    icon: Bot,
    title: 'AI Draft & Admin Review',
    desc: 'AI drafts the quote and sends it to the admin via email instantly. Admin reviews and sends the AI-assisted estimated bill.'
  },
  {
    num: '3',
    icon: UserCheck,
    title: 'Accept & Dispatch',
    desc: 'User accepts the quote. It goes to the best technician who adds progress notes daily.'
  },
  {
    num: '4',
    icon: CreditCard,
    title: 'Auto-Pay & Receipt',
    desc: 'Job marked complete. Automatically routes to Stripe for secure payment and Make.com issues an instant automated receipt.'
  }
];

export default function Sequence() {
  return (
    <section className="section container">
      <h2 className="section-title">THE SEQUENCE.</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
        
        {/* Connecting Line (Desktop) */}
        <div style={{
          position: 'absolute',
          left: '48px',
          top: '0',
          bottom: '0',
          width: '2px',
          background: 'rgba(255, 255, 255, 0.1)',
          zIndex: 0
        }} className="hidden-mobile"></div>

        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: i * 0.15 }}
            style={{
              display: 'flex',
              gap: '3rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 1
            }}
          >
            <div style={{
              width: '100px',
              height: '100px',
              flexShrink: 0,
              background: 'var(--accent-color)',
              color: '#121514',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-marker)',
              fontSize: '3rem',
              boxShadow: '0 0 30px rgba(183,255,0,0.2)'
            }}>
              {step.num}
            </div>
            
            <CardWithSpotlight step={step} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CardWithSpotlight({ step }: { step: any }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '2.5rem',
      borderRadius: '24px',
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseMove={handleMouseMove}
    onMouseEnter={() => setOpacity(1)}
    onMouseLeave={() => setOpacity(0)}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(183,255,0,0.15), transparent 40%)`,
        opacity,
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
        zIndex: 0
      }} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <step.icon size={32} color="var(--accent-color)" />
          <h3 style={{ fontSize: 'var(--text-h3)' }}>{step.title}</h3>
        </div>
        <p style={{ fontSize: 'var(--text-large)', opacity: 0.8, lineHeight: 1.5 }}>
          {step.desc}
        </p>
      </div>
    </div>
  );
}
