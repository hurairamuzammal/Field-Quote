'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Team() {
  return (
    <section id="staff" className="section-pad-lg" style={{ background: 'var(--dark-green)', color: 'var(--text-light)' }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-lg)', alignItems: 'center' }}>
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ flex: '1 1 400px' }}
          >
            <div className="section-label" style={{ color: 'var(--lime)' }}>Our People</div>
            <h2 className="section-heading" style={{ marginBottom: 'var(--space-md)' }}>AWARD-WINNING TEAM.</h2>
            <p style={{ fontSize: 'var(--text-large)', opacity: 0.8, marginBottom: 'var(--space-md)', lineHeight: 1.7, maxWidth: '500px' }}>
              250+ highly trained professionals pushing the boundaries of field service operations.
              We don&apos;t just draft quotes — we build the future of electrical infrastructure.
            </p>
            <p style={{ fontSize: 'var(--text-base)', opacity: 0.6, marginBottom: 'var(--space-lg)', lineHeight: 1.6, maxWidth: '500px' }}>
              Every technician is NICEIC-certified, background-checked, and equipped with our real-time
              tracking system. Join a career path at the cutting edge of the industry.
            </p>

            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href="#contact"
              className="btn btn-outline-light"
            >
              Join Our Team <ArrowRight size={18} />
            </motion.a>
          </motion.div>

          {/* Visual card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            style={{
              flex: '1 1 350px',
              background: 'rgba(0, 224, 196, 0.75)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255,255,255,0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
              aspectRatio: '1 / 1',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
          >
            <div style={{
              fontSize: 'clamp(4rem, 10vw, 7rem)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: 'var(--dark-green)',
              lineHeight: 1
            }}>
              250+
            </div>
            <div style={{
              fontSize: 'var(--text-large)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: 'var(--dark-green)',
              opacity: 0.9,
              marginTop: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Certified Staff
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
