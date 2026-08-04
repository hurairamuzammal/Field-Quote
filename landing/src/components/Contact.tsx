'use client';

import { motion } from 'framer-motion';
import { MapPin, Mail, Award } from 'lucide-react';

export default function Contact() {
  return (
    <section className="section container">
      <h2 className="section-title">GET IN TOUCH.</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '24px' }}
        >
          <MapPin size={32} style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem' }}>Headquarters</h3>
          <p style={{ fontSize: 'var(--text-large)', opacity: 0.8 }}>
            100 Innovation Way<br/>
            Tech District, London<br/>
            EC1A 1BB, UK
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '24px' }}
        >
          <Mail size={32} style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem' }}>Email Us</h3>
          <p style={{ fontSize: 'var(--text-large)', opacity: 0.8 }}>
            hello@fieldquote.com<br/>
            support@fieldquote.com
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '24px', background: 'var(--text-color)', color: 'var(--bg-color)' }}
        >
          <Award size={32} style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem' }}>Certified By</h3>
          <p style={{ fontSize: 'var(--text-large)', opacity: 0.8 }}>
            ISO 9001:2015<br/>
            NICEIC Approved Contractor<br/>
            TrustMark Registered
          </p>
        </motion.div>
      </div>
    </section>
  );
}
