'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function LoginPage() {
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
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
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
            maxWidth: '450px',
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: 'clamp(2rem, 5vw, 3rem)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.5)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--dark-green)', fontWeight: 800 }}>
              WELCOME <span style={{ color: '#fff' }}>BACK</span>
            </h1>
            <p style={{ color: 'rgba(11,29,44,0.7)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>Sign in to your FieldQuote dashboard</p>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Email */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Mail size={16} color="var(--dark-green)" /> Email Address
              </label>
              <input type="email" placeholder="admin@example.com" style={inputStyle} />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(11,29,44,0.9)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Lock size={16} color="var(--dark-green)" /> Password
                </span>
                <Link href="#" style={{ textTransform: 'none', color: 'rgba(11,29,44,0.6)', textDecoration: 'underline', fontSize: '0.8rem', fontWeight: 600 }}>Forgot?</Link>
              </label>
              <input type="password" placeholder="••••••••" style={inputStyle} />
            </div>

            <div style={{ height: '0.5rem' }} />

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(11,29,44,0.2)' }}
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
                fontSize: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'box-shadow 0.3s'
              }}
            >
              Sign In
            </motion.button>
            
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'rgba(11,29,44,0.7)', fontWeight: 600 }}>
                Don&apos;t have an account? <Link href="#" style={{ color: 'var(--dark-green)', fontWeight: 800, textDecoration: 'underline' }}>Sign up</Link>
              </p>
            </div>

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
  fontWeight: 500,
  outline: 'none',
  transition: 'border-color 0.3s, background 0.3s'
};
