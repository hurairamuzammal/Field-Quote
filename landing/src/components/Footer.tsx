'use client';

import { motion } from 'framer-motion';
import Logo from '@/components/Logo';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--near-black)',
      color: 'var(--text-light)',
      paddingTop: 'var(--space-xl)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="container">
        {/* Top row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)'
        }}>
          <div style={{ maxWidth: '350px' }}>
            <div style={{ marginBottom: '1rem' }}>
              <Logo color="var(--lime)" size={28} />
            </div>
            <p style={{ fontSize: 'var(--text-base)', opacity: 0.6, lineHeight: 1.6 }}>
              Next-gen quoting for independent electrical teams. From first enquiry to paid invoice in minutes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', opacity: 0.4 }}>Product</div>
              {['Services', 'How It Works', 'FAQ'].map(link => (
                <a key={link} href={`#${link.toLowerCase().replace(/\s/g, '-')}`} style={{ display: 'block', fontSize: 'var(--text-base)', opacity: 0.7, marginBottom: '0.6rem' }}>{link}</a>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', opacity: 0.4 }}>Company</div>
              {['About', 'Team', 'Contact'].map(link => (
                <a key={link} href={`#${link.toLowerCase()}`} style={{ display: 'block', fontSize: 'var(--text-base)', opacity: 0.7, marginBottom: '0.6rem' }}>{link}</a>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', opacity: 0.4 }}>Social</div>
              {['Twitter', 'LinkedIn', 'Email'].map(link => (
                <motion.a
                  key={link}
                  href="#"
                  whileHover={{ color: 'var(--lime)', x: 4 }}
                  style={{ display: 'block', fontSize: 'var(--text-base)', opacity: 0.7, marginBottom: '0.6rem', transition: 'color 0.2s' }}
                >
                  {link}
                </motion.a>
              ))}
            </div>
          </div>
        </div>

        {/* Giant branding */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{
            fontSize: 'clamp(3rem, 10vw, 10rem)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            lineHeight: 0.85,
            letterSpacing: '-0.04em',
            textAlign: 'center',
            color: 'var(--lime)',
            padding: 'var(--space-lg) 0',
            opacity: 0.15,
            userSelect: 'none'
          }}
        >
          FIELDQUOTE.
        </motion.div>

        {/* Copyright */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          opacity: 0.35,
          fontSize: 'var(--text-sm)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '1.5rem 0'
        }}>
          <span>© 2026 FieldQuote. All rights reserved.</span>
          <span>Designed with precision.</span>
        </div>
      </div>
    </footer>
  );
}
