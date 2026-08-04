'use client';

import { motion } from 'framer-motion';
import { Mic, Bot, UserCheck, CreditCard } from 'lucide-react';
import { useState } from 'react';

const steps = [
  {
    num: '01',
    icon: Mic,
    title: 'Describe Your Job',
    desc: 'Type or dictate your electrical issue. Attach photos for clarity. Our system instantly captures the intent and categorises the work.'
  },
  {
    num: '02',
    icon: Bot,
    title: 'AI Drafts the Quote',
    desc: 'Claude drafts a quote from your live price book — it never invents a price. The admin receives it via email for rapid review and approval.'
  },
  {
    num: '03',
    icon: UserCheck,
    title: 'Accept & Dispatch',
    desc: 'You receive a secure, tokenized link to review and accept the quote. We dispatch the closest certified technician automatically.'
  },
  {
    num: '04',
    icon: CreditCard,
    title: 'Pay & Receive Receipt',
    desc: 'Job marked complete triggers Stripe checkout for secure split-deposit payment. Make.com issues an automated receipt instantly.'
  }
];

export default function Sequence() {
  return (
    <section id="how-it-works" className="section-pad-lg" style={{ background: 'var(--cream)' }}>
      <div className="container">
        <div className="section-label">The Process</div>
        <h2 className="section-heading">HOW IT WORKS.</h2>

        <div className="grid-2x2">
          {steps.map((step, i) => (
            <StepCard key={i} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.12 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        padding: '3.5rem 2.5rem',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Spotlight overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(500px circle at ${hoverPos.x}px ${hoverPos.y}px, rgba(0,224,196,0.12), transparent 40%)`,
        opacity: hovering ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-marker)',
          fontSize: '3.5rem',
          color: 'var(--lime)',
          lineHeight: 1,
          marginBottom: '1rem',
          opacity: 0.5
        }}>
          {step.num}
        </div>

        <step.icon size={28} strokeWidth={1.5} style={{ marginBottom: '1rem', color: 'var(--dark-green)' }} />

        <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '0.8rem', color: 'var(--text-dark)' }}>{step.title}</h3>
        <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.6 }}>{step.desc}</p>
      </div>
    </motion.div>
  );
}
