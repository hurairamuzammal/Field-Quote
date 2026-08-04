'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Team() {
  return (
    <section className="section container">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4rem', alignItems: 'center' }}>
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ flex: 1, minWidth: '300px' }}
        >
          <h2 className="section-title" style={{ borderBottom: 'none' }}>OUR PEOPLE.</h2>
          <p style={{ fontSize: 'var(--text-h3)', marginBottom: '2rem', lineHeight: 1.4 }}>
            We are a team of 250 highly trained professionals pushing the boundaries of field service operations. 
          </p>
          <p style={{ fontSize: 'var(--text-large)', opacity: 0.8, marginBottom: '3rem' }}>
            We don't just draft quotes; we build the future of electrical infrastructure. 
            Join our career path and work with the most advanced quoting workflow in the industry.
          </p>
          
          <motion.a 
            whileHover={{ scale: 1.05, backgroundColor: 'var(--text-color)', color: 'var(--bg-color)' }}
            whileTap={{ scale: 0.95 }}
            href="#careers" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1rem 2.5rem',
              border: '2px solid var(--text-color)',
              borderRadius: '100px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '1.1rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease, color 0.3s ease'
            }}
          >
            Join Our Career <ArrowRight style={{ marginLeft: '10px' }}/>
          </motion.a>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{
            flex: 1,
            minWidth: '300px',
            background: 'var(--accent-color)',
            borderRadius: '32px',
            padding: '4rem',
            position: 'relative',
            overflow: 'hidden',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ 
            fontSize: 'var(--text-hero)', 
            fontFamily: 'var(--font-marker)', 
            textAlign: 'center', 
            color: 'var(--text-color)', 
            lineHeight: 1,
            fontWeight: 400
          }}>
            250+<br/>
            <span style={{ fontSize: 'var(--text-large)', fontFamily: 'var(--font-display)', fontWeight: 800, opacity: 0.7 }}>STAFF 🤝</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
