'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SITE_LINKS } from '@/lib/site';

const motionEase = [0.16, 1, 0.3, 1] as const;

export default function Team() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section
      id="team"
      className="section-pad-lg"
      style={{ background: 'var(--dark-green)', color: 'var(--text-light)' }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-lg)',
            alignItems: 'center',
          }}
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -40 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reducedMotion ? 0 : 0.7, ease: motionEase }}
            style={{ flex: '1 1 400px' }}
          >
            <div className="section-label" style={{ color: 'var(--lime)' }}>
              Field operations
            </div>
            <h2 className="section-heading" style={{ marginBottom: 'var(--space-md)' }}>
              ASSIGNED ON SITE.
            </h2>
            <p
              style={{
                fontSize: 'var(--text-large)',
                opacity: 0.8,
                marginBottom: 'var(--space-md)',
                lineHeight: 1.7,
                maxWidth: '500px',
              }}
            >
              After a quote is accepted and any required deposit is paid, the office assigns a
              technician and confirms the visit window. The job record travels with them — scope,
              notes, and customer details in one place.
            </p>
            <p
              style={{
                fontSize: 'var(--text-base)',
                opacity: 0.6,
                marginBottom: 'var(--space-lg)',
                lineHeight: 1.6,
                maxWidth: '500px',
              }}
            >
              Every visit is field-assigned and documented: arrival, work performed, completion
              photo, and close-out notes before the final invoice goes out.
            </p>

            <motion.a
              whileHover={reducedMotion ? undefined : { scale: 1.04 }}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              href={SITE_LINKS.requestQuote}
              className="btn btn-outline-light"
            >
              Request a quote <ArrowRight size={18} />
            </motion.a>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: reducedMotion ? 0 : 0.7,
              delay: reducedMotion ? 0 : 0.15,
              ease: motionEase,
            }}
            style={{
              flex: '1 1 350px',
              background: 'rgba(0, 224, 196, 0.75)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow:
                '0 8px 32px 0 rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255,255,255,0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
              aspectRatio: '1 / 1',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
                fontFamily: 'var(--font-marker-face)',
                fontWeight: 400,
                color: 'var(--dark-green)',
                lineHeight: 1.05,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Field-
              <br />
              assigned
            </div>
            <div
              style={{
                fontSize: 'var(--text-large)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--dark-green)',
                opacity: 0.9,
                marginTop: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Documented visits
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
