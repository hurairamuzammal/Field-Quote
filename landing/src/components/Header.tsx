'use client';

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { SITE_LINKS } from '@/lib/site';

const navLinks = [
  { label: 'The flow', href: '#how-it-works', id: 'how-it-works' },
  { label: 'Pricing', href: '#pricing', id: 'pricing' },
  { label: 'Waitlist', href: '#waitlist', id: 'waitlist' },
];

const morphEase = [0.16, 1, 0.3, 1] as const;

function pickActiveSection(sectionIds: string[]): string | null {
  const marker = 140;
  let active: string | null = null;

  for (const id of sectionIds) {
    const section = document.getElementById(id);
    if (!section) continue;
    if (section.getBoundingClientRect().top <= marker) {
      active = id;
    }
  }

  return active;
}

export default function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 50);
  });

  useEffect(() => {
    const sectionIds = navLinks.map((link) => link.id);

    const syncActiveSection = () => {
      setActiveSection(pickActiveSection(sectionIds));
    };

    syncActiveSection();
    window.addEventListener('scroll', syncActiveSection, { passive: true });
    window.addEventListener('hashchange', syncActiveSection);

    return () => {
      window.removeEventListener('scroll', syncActiveSection);
      window.removeEventListener('hashchange', syncActiveSection);
    };
  }, []);

  const handleNavClick = (
    sectionId: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    setActiveSection(sectionId);
    event.currentTarget.blur();
    setMenuOpen(false);
  };

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

  const handleLogoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
    setActiveSection(null);
    setMenuOpen(false);
  };

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
          width: scrolled ? 'min(94%, 1080px)' : '100%',
          padding: scrolled ? '8px 8px 8px 22px' : '20px clamp(1.5rem, 5vw, 4rem)',
          zIndex: 200,
          borderRadius: scrolled ? 'var(--radius-pill)' : 0,
          transition: morphTransition,
        }}
      >
        <Link
          className="site-logo-link"
          href="/"
          aria-label="FieldQuote home — scroll to top"
          onClick={handleLogoClick}
        >
          <Logo color="var(--text-dark)" size={22} />
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              data-active={activeSection === link.id}
              aria-current={activeSection === link.id ? 'true' : undefined}
              onClick={(event) => handleNavClick(link.id, event)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
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
            <a
              key={link.label}
              href={link.href}
              data-active={activeSection === link.id}
              onClick={(event) => handleNavClick(link.id, event)}
            >
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
