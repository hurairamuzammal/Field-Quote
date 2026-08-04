'use client';

import { motion } from 'framer-motion';
import { Home, ShieldCheck, BatteryCharging, Zap } from 'lucide-react';

const services = [
  { icon: Home, title: 'Consumer Units', desc: 'Full replacements and safe upgrades for residential properties. High-end finish with strict NICEIC compliance standards.' },
  { icon: ShieldCheck, title: 'EICR Testing', desc: 'Thorough inspection and reporting. AI drafts the initial findings for rapid admin review and technician dispatch.' },
  { icon: BatteryCharging, title: 'EV Charger Installs', desc: 'Home and commercial installations. Smart routing pairs the job with the closest certified technician automatically.' },
  { icon: Zap, title: 'Fault Finding', desc: 'Rapid diagnostics and repair. The system tracks parts usage and issues instant invoices upon resolution.' },
];

export default function Services() {
  return (
    <section id="services" className="section-pad-lg" style={{ background: 'var(--dark-green)', color: 'var(--text-light)', paddingTop: '7rem' }}>
      <div className="container">
        <div className="section-label" style={{ color: 'var(--lime)' }}>What We Do</div>
        <h2 className="section-heading">OUR SERVICES.</h2>

        <div className="grid-2x2">
          {services.map((svc, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              style={{
                padding: '3.5rem 2.5rem',
                border: '1px solid var(--border-dark)',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem'
              }}
            >
              <svc.icon size={36} strokeWidth={1.5} color="var(--lime)" />
              <h3 style={{ fontSize: 'var(--text-h3)', lineHeight: 1.1 }}>{svc.title}</h3>
              <p style={{ fontSize: 'var(--text-base)', opacity: 0.75, lineHeight: 1.6 }}>{svc.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
