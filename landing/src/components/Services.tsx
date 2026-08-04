'use client';

import { motion } from 'framer-motion';
import { Home, ShieldCheck, BatteryCharging, Zap } from 'lucide-react';

const services = [
  { icon: Home, title: 'Consumer Units', desc: 'Full replacements and safe upgrades for residential properties. High-end finish and strict compliance.' },
  { icon: ShieldCheck, title: 'EICR Testing', desc: 'Thorough inspection and reporting. AI drafts the initial findings for rapid admin review and dispatch.' },
  { icon: BatteryCharging, title: 'EV Chargers', desc: 'Home and commercial installations. Smart routing pairs the job with the closest certified technician.' },
  { icon: Zap, title: 'Fault Finding', desc: 'Rapid diagnostics and repair. The system tracks parts and issues instant invoices upon resolution.' },
];

export default function Services() {
  return (
    <section className="container" style={{ paddingBottom: '10vh' }}>
      <div style={{ position: 'sticky', top: '120px', zIndex: 10, marginBottom: '2rem' }}>
        <h2 className="section-title">WHAT WE DO.</h2>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '4rem' }}>
        {services.map((svc, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'sticky',
              top: `calc(200px + ${i * 20}px)`,
              padding: '4rem 3rem',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '32px',
              backgroundColor: '#1a1d1c',
              color: '#F6F7F6',
              boxShadow: '0 -20px 40px rgba(0,0,0,0.3)',
              transformOrigin: 'top center',
              zIndex: i,
              maxWidth: '800px',
              width: '100%',
              margin: '0 auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5rem' }}>
              <svc.icon size={64} strokeWidth={1.5} color="var(--accent-color)" />
              <div>
                <h3 style={{ fontSize: 'var(--text-h2)', marginBottom: '1rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{svc.title}</h3>
                <p style={{ fontSize: 'var(--text-large)', opacity: 0.8, lineHeight: 1.6 }}>{svc.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
