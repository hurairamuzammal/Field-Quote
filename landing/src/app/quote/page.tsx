'use client';

import { motion } from 'framer-motion';
import { Camera, Mic, Clock, MapPin, Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function QuotePage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--lime)',
      color: 'var(--dark-green)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient glow */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Simple Header */}
      <header style={{ padding: '2rem 5%', position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(11,29,44,0.7)', textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={20} /> Back
        </Link>
        <Logo color="var(--dark-green)" size={24} />
        <div style={{ width: '70px' }} /> {/* Spacer for centering */}
      </header>

      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', position: 'relative', zIndex: 10 }}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: '850px',
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: 'clamp(2rem, 5vw, 4rem)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.5)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', marginBottom: '0.5rem', color: 'var(--dark-green)' }}>
              REQUEST A <span style={{ color: '#fff' }}>QUOTE</span>
            </h1>
            <p style={{ color: 'rgba(11,29,44,0.7)', fontSize: 'var(--text-base)' }}>Describe your electrical issue and get an AI-drafted estimate in minutes.</p>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Split Row */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 250px' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                <input type="text" placeholder="John Doe" style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 250px' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                <input type="email" placeholder="john@example.com" style={inputStyle} />
              </div>
            </div>

            {/* Address */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <MapPin size={16} color="var(--dark-green)" /> Service Address
              </label>
              <input type="text" placeholder="123 Electric Ave, London" style={inputStyle} />
            </div>

            {/* Time */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Clock size={16} color="var(--dark-green)" /> Preferred Time
              </label>
              <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                <option value="asap" style={{ color: '#000' }}>As soon as possible</option>
                <option value="next_few_days" style={{ color: '#000' }}>Within the next few days</option>
                <option value="flexible" style={{ color: '#000' }}>Flexible</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Description</label>
              <textarea 
                rows={4} 
                placeholder="What seems to be the problem? E.g., The consumer unit keeps tripping when I turn on the oven." 
                style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }} 
              />
            </div>

            {/* Media Uploads */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <motion.button 
                whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.4)' }}
                whileTap={{ scale: 0.98 }}
                type="button" 
                style={mediaBtnStyle}
              >
                <Camera size={20} color="var(--dark-green)" />
                <span>Add Photos</span>
              </motion.button>
              
              <motion.button 
                whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.4)' }}
                whileTap={{ scale: 0.98 }}
                type="button" 
                style={mediaBtnStyle}
              >
                <Mic size={20} color="var(--dark-green)" />
                <span>Voice Note</span>
              </motion.button>
            </div>

            <div style={{ height: '1rem' }} />

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,224,196,0.3)' }}
              whileTap={{ scale: 0.98 }}
              type="button"
              style={{
                width: '100%',
                padding: '1.2rem',
                background: 'var(--dark-green)',
                color: 'var(--lime)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '1.1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'box-shadow 0.3s'
              }}
            >
              Get Instant Quote <Send size={18} />
            </motion.button>

          </form>
        </motion.div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '1rem 1.2rem',
  background: 'rgba(255,255,255,0.4)',
  border: '1px solid rgba(255,255,255,0.6)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--dark-green)',
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.3s, background 0.3s'
};

const mediaBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.6rem',
  padding: '1rem',
  background: 'rgba(255,255,255,0.2)',
  border: '1px dashed rgba(11,29,44,0.3)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--dark-green)',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: '0.95rem',
  cursor: 'pointer',
  transition: 'all 0.2s'
};
