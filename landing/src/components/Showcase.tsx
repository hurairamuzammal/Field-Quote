'use client';

import { motion } from 'framer-motion';
import { Shield, Smartphone, Receipt } from 'lucide-react';
import Image from 'next/image';

export default function Showcase() {
  return (
    <section className="section-pad-lg" style={{ background: 'var(--dark-green)', color: 'var(--text-light)' }}>
      <div className="container">
        <div className="section-label" style={{ color: 'var(--lime)' }}>The Platform</div>
        <h2 className="section-heading">EVERYTHING YOU NEED.</h2>

        {/* Row 1: App mockup + text */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
          gap: 'var(--space-lg)',
          alignItems: 'center',
          marginBottom: 'var(--space-xl)'
        }}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Smartphone size={36} strokeWidth={1.5} color="var(--lime)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem' }}>LIVE TECHNICIAN DASHBOARD</h3>
            <p style={{ fontSize: 'var(--text-large)', opacity: 0.75, lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Every technician gets a real-time mobile dashboard. See current jobs, update progress, add notes, and mark completions — all from the field. GPS-tracked dispatch finds the closest certified tech automatically.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['Real-time job tracking', 'GPS-based dispatch', 'Daily progress notes', 'One-tap completion'].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'var(--text-base)', opacity: 0.7 }}>
                  <span style={{ color: 'var(--lime)', fontSize: '1.2em' }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div style={{ width: '320px', maxWidth: '100%', position: 'relative' }}>
              <Image
                src="/images/app-mockup.png"
                alt="FieldQuote technician dashboard"
                width={320}
                height={640}
                style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}
              />
            </div>
          </motion.div>
        </div>

        {/* Row 2: Receipt + Stripe */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
          gap: 'var(--space-lg)',
          alignItems: 'center'
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ display: 'flex', justifyContent: 'center', order: 1 }}
            className="hide-mobile"
          >
            <div style={{ width: '340px', maxWidth: '100%', position: 'relative' }}>
              <Image
                src="/images/receipt-mockup.png"
                alt="FieldQuote digital receipt"
                width={340}
                height={440}
                style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ order: 2 }}
          >
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '1rem' }}>
              <Shield size={36} strokeWidth={1.5} color="var(--lime)" />
              <Receipt size={36} strokeWidth={1.5} color="var(--lime)" />
            </div>
            <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: '1rem' }}>SECURE PAYMENTS & INSTANT RECEIPTS</h3>
            <p style={{ fontSize: 'var(--text-large)', opacity: 0.75, lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Stripe handles PCI-compliant checkout with split deposits. The moment a job completes, Make.com fires an automated workflow that generates and delivers a professional digital receipt — zero manual steps.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['Stripe hosted checkout', 'Split deposit collection', 'Instant automated receipts', 'PCI DSS Level 1 compliant'].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'var(--text-base)', opacity: 0.7 }}>
                  <span style={{ color: 'var(--lime)', fontSize: '1.2em' }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
