'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

const words = ['Clarity', 'Trust', 'Power', 'Speed'];

export default function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIndex];
    const speed = deleting ? 50 : 90;

    const timer = setTimeout(() => {
      if (!deleting && text === word) {
        setTimeout(() => setDeleting(true), 1800);
      } else if (deleting && text === '') {
        setDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
      } else {
        setText(deleting ? text.slice(0, -1) : word.slice(0, text.length + 1));
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [text, deleting, wordIndex]);

  return (
    <section className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '120px', paddingBottom: '60px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="tag"
        >
          AI-Powered Quoting
        </motion.div>
      </div>



      {/* Giant headline — fixed dimensions prevent typewriter reflow */}
      <div style={{ fontSize: 'var(--text-hero)', lineHeight: 1, marginBottom: 'var(--space-md)', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ overflow: 'hidden' }}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            OPERATE ⚡
          </motion.div>
        </div>

        <div style={{ overflow: 'hidden', height: '1.1em' }}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <span>WITH </span>
            <span style={{
              color: 'var(--lime)',
              fontFamily: 'var(--font-marker)',
              fontWeight: 400,
              textTransform: 'none',
              textShadow: '0 0 60px rgba(0,224,196,0.3)'
            }}>
              {text}
            </span>
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
              style={{
                display: 'inline-block',
                width: '4px',
                height: '0.7em',
                background: 'var(--lime)',
                marginLeft: '3px',
                borderRadius: '2px',
                verticalAlign: 'baseline'
              }}
            />
          </motion.div>
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ 
          fontSize: 'var(--text-large)', 
          color: '#68736E', 
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto var(--space-lg)'
        }}
      >
        From first enquiry to paid invoice — streamlined for independent electrical teams.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        <motion.a
          whileHover={{ scale: 1.04, boxShadow: '0 12px 40px rgba(0,224,196,0.35)' }}
          whileTap={{ scale: 0.97 }}
          href="https://fieldquote-26446.bubbleapps.io/version-13h94"
          className="btn btn-primary"
          style={{ fontSize: '1.1rem', padding: '1.1rem 2.8rem' }}
        >
          Start Quoting <ArrowRight size={20} />
        </motion.a>
        <motion.a
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          href="#how-it-works"
          className="btn btn-outline-dark"
        >
          How It Works
        </motion.a>
      </motion.div>
    </section>
  );
}
