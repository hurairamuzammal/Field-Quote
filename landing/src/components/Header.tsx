'use client';

import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import Logo from '@/components/Logo';

const navLinks = [
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
];

export default function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: scrolled ? '16px' : '0',
        left: 0,
        right: 0,
        margin: '0 auto',
        width: scrolled ? 'min(92%, 1000px)' : '100%',
        padding: scrolled ? '10px 10px 10px 24px' : '20px clamp(1.5rem, 5vw, 4rem)',
        zIndex: 100,
        background: scrolled ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
        border: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        borderRadius: scrolled ? 'var(--radius-pill)' : '0',
        boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.12)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }}
    >
      {/* Logo */}
      <a href="#" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <Logo color="var(--text-dark)" size={22} />
      </a>

      {/* Nav Links — hide on mobile */}
      <nav className="hide-mobile" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {navLinks.map((link) => (
          <motion.a
            key={link.label}
            href={link.href}
            whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: 'var(--text-dark)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderRadius: 'var(--radius-pill)',
              textDecoration: 'none',
              transition: 'background 0.2s'
            }}
          >
            {link.label}
          </motion.a>
        ))}
      </nav>

      {/* CTA Buttons */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <motion.a
          whileHover={{ scale: 1.03, boxShadow: '0 6px 24px rgba(11,29,44,0.4)' }}
          whileTap={{ scale: 0.97 }}
          href="https://fieldquote-26446.bubbleapps.io/version-13h94/login"
          style={{
            padding: '10px 22px',
            background: 'var(--dark-green)',
            color: 'var(--cream)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.85rem',
            borderRadius: 'var(--radius-pill)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            textDecoration: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          Login
        </motion.a>
      </div>
    </motion.header>
  );
}
