'use client';

import Logo from '@/components/Logo';
import { motion, useReducedMotion } from 'framer-motion';
import { SITE_LINKS } from '@/lib/site';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-40px' as const };

export default function Footer() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <footer className="site-footer">
      <div className="container">
        <motion.div
          className="footer-top"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.55, ease }}
        >
          <div className="footer-brand">
            <Logo color="var(--lime)" size={28} />
            <p>
              A clear electrical-service journey from first request to completed,
              documented work.
            </p>
          </div>

          <div className="footer-links">
            <div>
              <p className="footer-column-label">Explore</p>
              <a href="#services">Services</a>
              <a href="#how-it-works">The flow</a>
              <a href="#proof">Product</a>
              <a href="#pricing">Pricing</a>
              <a href="#about">How we work</a>
              <a href="#team">Field visits</a>
              <a href="#faq">Questions</a>
            </div>
            <div>
              <p className="footer-column-label">Actions</p>
              <a href={SITE_LINKS.requestQuote}>Request a quote</a>
              <a href="#waitlist">Join the waitlist</a>
              <a href={SITE_LINKS.staffLogin}>Staff sign in</a>
            </div>
            <div>
              <p className="footer-column-label">Company</p>
              <span>© {new Date().getFullYear()} FieldQuote.</span>
              <span>All rights reserved.</span>
            </div>
          </div>
        </motion.div>
      </div>
      <motion.div
        className="footer-wordmark"
        aria-hidden="true"
        initial={reducedMotion ? false : { opacity: 0 }}
        whileInView={{ opacity: 0.14 }}
        viewport={viewOnce}
        transition={{ duration: 0.8, ease }}
      >
        FIELDQUOTE.
      </motion.div>
    </footer>
  );
}
