'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { SITE_LINKS } from '@/lib/site';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-60px' as const };

export default function Contact() {
  const reducedMotion = Boolean(useReducedMotion());
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing', hp }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setStatus('err');
        setMessage(data.error || 'Something went wrong. Try again.');
        return;
      }
      setStatus('ok');
      setMessage(
        data.already
          ? "You're already on the waitlist — we'll be in touch."
          : "You're on the list. Check your inbox for a confirmation.",
      );
      setEmail('');
    } catch {
      setStatus('err');
      setMessage('Network error. Try again.');
    }
  }

  return (
    <>
      <section id="contact" className="quote-handoff section-pad" aria-labelledby="handoff-heading">
        <div className="container handoff-grid">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewOnce}
            transition={{ duration: 0.55, ease }}
          >
            <p className="section-label">Start with the issue</p>
            <h2 id="handoff-heading">Tell us what needs fixing.</h2>
            <p>
              Add the job details, your preferred timing, and useful photos or a voice
              note. The request goes directly into the working quote flow for review.
            </p>
          </motion.div>
          <motion.div
            className="handoff-actions"
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewOnce}
            transition={{ duration: 0.55, delay: reducedMotion ? 0 : 0.08, ease }}
          >
            <a className="btn btn-dark" href={SITE_LINKS.requestQuote}>
              Request a quote <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="handoff-login" href={SITE_LINKS.staffLogin}>
              FieldQuote staff sign in
            </a>
          </motion.div>
        </div>
      </section>

      <section id="waitlist" className="waitlist-strip" aria-labelledby="waitlist-heading">
        <motion.div
          className="container waitlist-row"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.55, ease }}
        >
          <div>
            <h3 id="waitlist-heading">Join the waitlist</h3>
            <p>Early access for field-service teams. One email — confirmation only.</p>
          </div>
          <form className="waitlist-form" onSubmit={onSubmit}>
            <input
              type="text"
              name="company_website"
              value={hp}
              onChange={(ev) => setHp(ev.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="waitlist-honeypot"
            />
            <div className="waitlist-fields">
              <label className="sr-only" htmlFor="waitlist-email">
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                name="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="your@email.com"
                disabled={status === 'loading'}
                autoComplete="email"
              />
              <motion.button
                type="submit"
                className="btn btn-primary waitlist-submit"
                disabled={status === 'loading'}
                whileHover={
                  reducedMotion ? undefined : { scale: 1.04, boxShadow: '0 6px 24px rgba(0,224,196,0.3)' }
                }
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              >
                <Send size={16} aria-hidden="true" /> {status === 'loading' ? '…' : 'Join'}
              </motion.button>
            </div>
            {message ? (
              <p className={status === 'err' ? 'waitlist-message waitlist-message--err' : 'waitlist-message'} role="status">
                {message}
              </p>
            ) : null}
          </form>
        </motion.div>
        <div className="waitlist-rule" aria-hidden="true" />
      </section>
    </>
  );
}
