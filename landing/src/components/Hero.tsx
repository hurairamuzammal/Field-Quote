'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

const words = ['Clarity', 'Trust', 'Power', 'Speed'];

export default function Hero() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const typeSpeed = isDeleting ? 60 : 100;
    const word = words[currentWordIndex];

    const timer = setTimeout(() => {
      if (!isDeleting && currentText === word) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      } else {
        setCurrentText((prev) => 
          isDeleting ? prev.slice(0, -1) : word.slice(0, prev.length + 1)
        );
      }
    }, typeSpeed);

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentWordIndex]);
  return (
    <section className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="tag"
        >
          Electrical Service Quotes
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ maxWidth: '300px', fontSize: 'var(--text-base)', color: '#68736E' }}
        >
          We bring high-end operational flow to independent electrical teams. Professional quotes, faster response.
        </motion.div>
      </div>

      <motion.div 
        style={{ fontSize: 'var(--text-hero)', maxWidth: '1200px', marginBottom: '3rem', lineHeight: 1 }}
      >
        <div style={{ display: 'flex', overflow: 'hidden' }}>
          {"OPERATE".split('').map((char, i) => (
            <motion.span
              key={i}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              {char}
            </motion.span>
          ))}
          <motion.span
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5, type: 'spring' }}
            style={{ marginLeft: '1rem' }}
          >
            ⚡️
          </motion.span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <motion.span
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginRight: '2rem' }}
          >
            WITH
          </motion.span>
          <motion.span 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ 
              color: 'var(--accent-color)', 
              fontFamily: 'var(--font-marker)', 
              textShadow: '0 0 40px rgba(183,255,0,0.3)', 
              fontWeight: 400, 
              textTransform: 'none',
              display: 'inline-block'
            }}
          >
            {currentText}
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              style={{ display: 'inline-block', width: '4px', height: '1em', background: 'var(--accent-color)', marginLeft: '4px', verticalAlign: 'middle' }}
            />
          </motion.span>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', gap: '1rem' }}
      >
        <motion.a 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="https://fieldquote-26446.bubbleapps.io/version-13h94" 
          className="btn"
        >
          Start Quoting <ArrowRight style={{ marginLeft: '10px' }}/>
        </motion.a>
        <motion.a 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          href="#docs" 
          className="btn btn-outline"
        >
          How It Works
        </motion.a>
      </motion.div>
    </section>
  );
}
