'use client';

import { ArrowRight, Camera, CreditCard, UserRoundCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { SITE_LINKS } from '@/lib/site';
import CircuitBackdrop from './CircuitBackdrop';

const ease = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <CircuitBackdrop />
      <div className="container hero-grid">
        <motion.div
          className="hero-copy"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
        >
          <p className="hero-kicker">Electrical service, without the waiting around</p>
          <h1 id="hero-heading">
            Get your electrical issue fixed
            <span>in hours, not days.</span>
          </h1>
          <p className="hero-lede">
            Tell us what needs attention, add photos or a voice note, and receive a
            professionally reviewed quote. From approval to the completed job, every
            next step stays clear.
          </p>
          <div className="hero-actions">
            <motion.a
              className="btn btn-primary"
              href={SITE_LINKS.requestQuote}
              whileHover={
                reducedMotion
                  ? undefined
                  : { scale: 1.03, boxShadow: '0 8px 28px rgba(0, 224, 196, 0.38)' }
              }
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.2, ease }}
            >
              Request a quote <ArrowRight size={18} aria-hidden="true" />
            </motion.a>
            <motion.a
              className="btn btn-outline-dark"
              href="#how-it-works"
              whileHover={
                reducedMotion
                  ? undefined
                  : { scale: 1.03, boxShadow: '0 8px 28px rgba(0, 224, 196, 0.22)' }
              }
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.2, ease }}
            >
              See the service journey
            </motion.a>
          </div>
          <div className="hero-assurance" aria-label="Service process highlights">
            <span>
              <Camera size={16} aria-hidden="true" /> Add job photos
            </span>
            <span>
              <CreditCard size={16} aria-hidden="true" /> Secure checkout
            </span>
            <span>
              <UserRoundCheck size={16} aria-hidden="true" /> Human-reviewed quote
            </span>
          </div>
        </motion.div>

        <motion.div
          className="hero-preview"
          aria-label="Example FieldQuote service journey"
          initial={reducedMotion ? false : { opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: reducedMotion ? 0 : 0.12, ease }}
        >
          <div className="preview-topline">
            <span>Example service journey</span>
            <span className="preview-status">Request received</span>
          </div>

          <svg
            className="preview-wire"
            viewBox="0 0 560 330"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M28 62H142C175 62 175 112 208 112H340C373 112 373 164 406 164H532"
              stroke="rgba(240,244,248,0.22)"
              strokeWidth="2"
            />
            <motion.path
              d="M28 104H98C131 104 131 154 164 154H288C321 154 321 216 354 216H532"
              stroke="#00E0C4"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="10 8"
              animate={reducedMotion ? undefined : { strokeDashoffset: [0, -36] }}
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 10, repeat: Infinity, ease: 'linear' }
              }
            />
            <path
              d="M28 146H76C109 146 109 202 142 202H236C269 202 269 264 302 264H532"
              stroke="rgba(240,244,248,0.22)"
              strokeWidth="2"
            />
            {[28, 164, 288, 406, 532].map((cx, index) => (
              <circle
                key={cx}
                cx={cx}
                cy={[104, 154, 154, 216, 216][index]}
                r="6"
                fill={index < 3 ? '#00E0C4' : '#0B1D2C'}
                stroke="#00E0C4"
                strokeWidth="2"
              />
            ))}
          </svg>

          <div className="preview-card">
            <p className="preview-card-label">Request summary</p>
            <h2>Consumer unit keeps tripping</h2>
            <dl className="preview-meta">
              <div>
                <dt>Preferred timing</dt>
                <dd>As soon as possible</dd>
              </div>
              <div>
                <dt>Job evidence</dt>
                <dd>2 photos attached</dd>
              </div>
            </dl>
            <ol className="preview-progress" aria-label="Example progress">
              <li>Request</li>
              <li>Quote</li>
              <li>Visit</li>
              <li>Complete</li>
            </ol>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
