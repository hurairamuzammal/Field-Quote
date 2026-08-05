'use client';

import { motion } from 'framer-motion';
import Logo from '@/components/Logo';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--dark-green)',
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
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', opacity: 0.4 }}>Legal</div>
              <span style={{ display: 'block', fontSize: 'var(--text-base)', opacity: 0.7, marginBottom: '0.6rem' }}>© 2026 FieldQuote.</span>
              <span style={{ display: 'block', fontSize: 'var(--text-base)', opacity: 0.7, marginBottom: '0.6rem' }}>All rights reserved.</span>
              <span style={{ display: 'block', fontSize: 'var(--text-base)', opacity: 0.7, marginBottom: '0.6rem', marginTop: '1.2rem' }}>Designed with precision.</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Spacer for absolute text */}
      <div style={{ height: '18vw', minHeight: '120px' }} />

      {/* Giant branding - Moved outside container for perfect edge-to-edge alignment */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        style={{
          fontSize: 'clamp(4rem, 12.5vw, 25rem)', /* tuned so 11 chars fit perfectly inside the footer element width */
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          lineHeight: 0.75,
          letterSpacing: '-0.06em',
          textAlign: 'center',
          color: 'var(--lime)',
          padding: 0,
          opacity: 0.15,
          userSelect: 'none',
          position: 'absolute',
          bottom: '-4%',
          left: 0,
          right: 0,
          whiteSpace: 'nowrap',
          width: '100%', /* explicitly use the element's 100% width, not viewport width, to avoid scrollbar overflow */
          zIndex: 0
        }}
      >
        FIELDQUOTE.
      </motion.div>
    </footer>
  );
}
