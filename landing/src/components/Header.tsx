'use client';

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Logo from '@/components/Logo';
import { SITE_LINKS } from '@/lib/site';

const navLinks = [
  { label: 'Services', href: '#services' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'On-site proof', href: '#proof' },
  { label: 'Questions', href: '#faq' },
];

const morphEase = [0.16, 1, 0.3, 1] as const;

export default function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 50);
  });

  useEffect(() => {
    if (!menuOpen) return;

    menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const morphTransition = prefersReducedMotion
    ? 'none'
    : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

  const ctaMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.03, boxShadow: '0 6px 24px rgba(0, 224, 196, 0.3)' },
        whileTap: { scale: 0.97 },
      };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <motion.header
        className="site-header"
        data-scrolled={scrolled}
        initial={prefersReducedMotion ? false : { y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={
          prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [...morphEase] }
        }
        style={{
          position: 'fixed',
          top: scrolled ? 16 : 0,
          left: 0,
          right: 0,
          margin: '0 auto',
          width: scrolled ? 'min(92%, 1000px)' : '100%',
          padding: scrolled ? '10px 10px 10px 24px' : '20px clamp(1.5rem, 5vw, 4rem)',
          zIndex: 100,
          background: scrolled
            ? 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(24px) saturate(200%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(200%)' : 'none',
          border: scrolled ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
          borderRadius: scrolled ? 'var(--radius-pill)' : 0,
          boxShadow: scrolled
            ? '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)'
            : 'none',
          transition: morphTransition,
        }}
      >
        <Link className="site-logo-link" href="/" aria-label="FieldQuote home">
          <Logo color="var(--text-dark)" size={22} />
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navLinks.map((link) =>
            prefersReducedMotion ? (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ) : (
              <motion.a
                key={link.label}
                href={link.href}
                whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
              >
                {link.label}
              </motion.a>
            ),
          )}
        </nav>

        <div className="header-actions">
          <a className="header-login" href={SITE_LINKS.staffLogin}>
            Staff sign in
          </a>
          <motion.a
            className="btn btn-primary header-quote"
            href={SITE_LINKS.requestQuote}
            {...ctaMotion}
          >
            Request a quote <ArrowUpRight size={17} aria-hidden="true" />
          </motion.a>
          <button
            ref={menuButtonRef}
            className="mobile-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>

        <nav
          ref={menuRef}
          id="mobile-navigation"
          className="mobile-menu"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
        >
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href={SITE_LINKS.staffLogin} onClick={() => setMenuOpen(false)}>
            Staff sign in
          </a>
          <a className="btn btn-primary" href={SITE_LINKS.requestQuote} onClick={() => setMenuOpen(false)}>
            Request a quote <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </nav>
      </motion.header>
    </>
  );
}
