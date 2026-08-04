'use client';

import { motion, useScroll, useTransform } from 'framer-motion';

export default function Header() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 50], [0, 10]);

  return (
    <motion.header
      style={{
        y,
        position: 'fixed',
        top: '20px',
        left: 0,
        right: 0,
        margin: '0 auto',
        width: '90%',
        maxWidth: '1000px',
        padding: '12px 24px',
        zIndex: 100,
        background: 'rgba(246, 247, 246, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0,0,0,0.05)',
        borderRadius: '100px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
      }}
    >
      <div className="container" style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--text-color)' }}>
          FIELDQUOTE.
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <motion.a 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="#about" 
            style={{
              padding: '10px 16px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'var(--text-color)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
          >
            About
          </motion.a>
          
          <motion.a 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="#staff" 
            style={{
              padding: '10px 16px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'var(--text-color)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
          >
            Staff
          </motion.a>
          
          <motion.a 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="#contact" 
            style={{
              padding: '10px 16px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'var(--text-color)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
          >
            Contact
          </motion.a>
          
          <motion.a  
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="https://fieldquote-26446.bubbleapps.io/version-13h94/login" 
            style={{
              padding: '10px 24px',
              background: 'var(--accent-color)',
              color: '#000',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.9rem',
              borderRadius: '100px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              border: 'none',
              textDecoration: 'none'
            }}
          >
            Login
          </motion.a>
        </div>
      </div>
    </motion.header>
  );
}
