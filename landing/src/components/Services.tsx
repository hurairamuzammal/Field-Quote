'use client';

import { motion } from 'framer-motion';
import { Home, ShieldCheck, BatteryCharging, Zap } from 'lucide-react';
import HoverSpotlight from './HoverSpotlight';

const services = [
  { icon: Home, title: 'CONSUMER\nUNITS', desc: 'Full replacements and safe upgrades for residential properties. High-end finish with strict NICEIC compliance standards.' },
  { icon: ShieldCheck, title: 'EICR\nTESTING', desc: 'Thorough inspection and reporting. AI drafts the initial findings for rapid admin review and technician dispatch.' },
  { icon: BatteryCharging, title: 'EV CHARGER\nINSTALLS', desc: 'Home and commercial installations. Smart routing pairs the job with the closest certified technician automatically.' },
  { icon: Zap, title: 'FAULT\nFINDING', desc: 'Rapid diagnostics and repair. The system tracks parts usage and issues instant invoices upon resolution.' },
];

export default function Services() {
  return (
    <section id="services" className="section-pad-lg" style={{ background: 'var(--dark-green)', color: 'var(--text-light)', paddingTop: '7rem' }}>
      <div className="container">
        <div className="section-label" style={{ color: 'var(--lime)' }}>What We Do</div>
        <h2 className="section-heading">OUR SERVICES.</h2>

        <HoverSpotlight className="grid-2x2 glow-wrapper">
          {services.map((svc, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="glow-card"
              style={{
                padding: '3.5rem 2.5rem',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--lime)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem',
                boxShadow: '0 10px 30px rgba(0,224,196,0.15)'
              }}
            >
              <svc.icon size={44} strokeWidth={2} color="#fff" />
              <h3 style={{ fontFamily: 'var(--font-marker)', fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', lineHeight: 1.1, color: '#fff', fontWeight: 'normal', letterSpacing: '0.05em', whiteSpace: 'pre-line' }}>{svc.title}</h3>
              <p style={{ fontSize: 'var(--text-large)', opacity: 0.95, lineHeight: 1.6, fontWeight: 500 }}>{svc.desc}</p>
            </motion.div>
          ))}
        </HoverSpotlight>
      </div>
    </section>
  );
}
