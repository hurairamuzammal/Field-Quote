'use client';

import { motion } from 'framer-motion';
import { MapPin, Mail, Award, Send } from 'lucide-react';

export default function Contact() {
  return (
    <section id="contact" className="section-pad-lg" style={{ background: 'var(--cream)', paddingBottom: 0 }}>
      <div className="container">
        <div style={{
          background: 'var(--lime)',
          borderRadius: 'var(--radius-lg)',
          padding: '5rem 3rem',
          width: '85%',
          maxWidth: '1200px',
          margin: '0 auto var(--space-xl)',
          boxShadow: '0 20px 40px rgba(0,224,196,0.2)',
          color: '#000'
        }}>
          <div className="section-label" style={{ textAlign: 'center', color: 'var(--dark-green)', opacity: 0.8 }}>Get In Touch</div>
          <h2 className="section-heading" style={{ textAlign: 'center', color: '#000', marginBottom: '4rem' }}>CONTACT US.</h2>

          <div className="grid-3x3" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid rgba(255,255,255,0.8)', textAlign: 'center', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)' }}
            >
              <MapPin size={32} strokeWidth={2} style={{ margin: '0 auto 1.2rem', color: 'var(--dark-green)' }} />
              <h3 style={{ fontSize: 'var(--text-large)', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--dark-green)' }}>Headquarters</h3>
              <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.7 }}>
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
              style={{ padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid rgba(255,255,255,0.8)', textAlign: 'center', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)' }}
            >
              <Mail size={32} strokeWidth={2} style={{ margin: '0 auto 1.2rem', color: 'var(--dark-green)' }} />
              <h3 style={{ fontSize: 'var(--text-large)', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--dark-green)' }}>Email Us</h3>
              <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.7 }}>
                hello@fieldquote.com<br/>
                support@fieldquote.com
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{ padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid rgba(255,255,255,0.8)', textAlign: 'center', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)' }}
            >
              <Award size={32} strokeWidth={2} style={{ margin: '0 auto 1.2rem', color: 'var(--dark-green)' }} />
              <h3 style={{ fontSize: 'var(--text-large)', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--dark-green)' }}>Certified By</h3>
              <p style={{ fontSize: 'var(--text-base)', color: '#68736E', lineHeight: 1.7 }}>
                ISO 9001:2015<br/>
                NICEIC Approved<br/>
                TrustMark Registered
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Email CTA */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          background: 'var(--dark-green)',
          padding: '4rem 0',
          width: '100%',
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <div className="container" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-h3)', color: 'var(--text-light)', marginBottom: '0.5rem' }}>HAVE A QUESTION?</h3>
            <p style={{ fontSize: 'var(--text-base)', color: 'rgba(255,255,255,0.6)' }}>Drop your email and we&apos;ll get back within 24 hours.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 300px', maxWidth: '500px' }}>
            <input
              type="email"
              placeholder="your@email.com"
              style={{
                flex: 1,
                padding: '0.9rem 1.2rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-dark)',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-light)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                outline: 'none'
              }}
            />
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 6px 24px rgba(0,224,196,0.3)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '0.9rem 1.5rem',
                background: 'var(--lime)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <Send size={16} /> Send
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* 60% Centered Separator */}
      <div style={{ background: 'var(--dark-green)', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '60%', height: '1px', background: 'rgba(255,255,255,0.15)' }} />
      </div>
    </section>
  );
}
