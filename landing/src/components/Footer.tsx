'use client';

import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--text-color)',
      color: 'var(--bg-color)',
      padding: 'var(--space-xxl) 0 var(--space-md) 0',
      marginTop: 'var(--space-xl)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div style={{ fontSize: 'var(--text-large)', color: 'var(--accent-color)', marginBottom: '1rem' }}>READY TO START?</div>
            <p style={{ fontSize: 'var(--text-base)', maxWidth: '400px', opacity: 0.8 }}>
              Join the new standard in field service quoting. Clean, professional, and built for speed.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '2rem' }}>
            {['Twitter', 'LinkedIn', 'Email'].map(link => (
              <motion.a 
                key={link}
                href="#"
                whileHover={{ y: -5, color: 'var(--accent-color)' }}
                style={{ fontSize: 'var(--text-large)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase' }}
              >
                {link}
              </motion.a>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          style={{
            fontSize: 'min(11vw, 200px)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            lineHeight: 0.8,
            letterSpacing: '-0.04em',
            textAlign: 'center',
            color: 'var(--accent-color)',
            marginBottom: '4rem',
            width: '100%',
            overflow: 'hidden'
          }}
        >
          FIELDQUOTE.
        </motion.div>

        <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.5, fontSize: 'var(--text-sm)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
          <span>© 2026 FieldQuote. All rights reserved.</span>
          <span>Designed with precision.</span>
        </div>
      </div>
    </footer>
  );
}
