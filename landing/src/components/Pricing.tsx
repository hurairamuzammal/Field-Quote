'use client';

import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-80px' as const };

const seats = [
  {
    code: '01',
    name: 'Solo van',
    who: 'One electrician running their own book',
    includes: 'Intake, reviewed quotes, deposit, job close-out',
    amount: 'TBA',
  },
  {
    code: '02',
    name: 'Crew',
    who: 'Owner plus technicians on the board',
    includes: 'Assign, tech mobile view, live job status',
    amount: 'TBA',
    quoted: true,
  },
  {
    code: '03',
    name: 'Dispatch desk',
    who: 'The person who sends the work out',
    includes: 'Ops board, waitlist early access, launch note',
    amount: 'TBA',
  },
];

export default function Pricing() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section id="pricing" className="pricing section-pad-lg" aria-labelledby="pricing-heading">
      <div className="container pricing-grid">
        <motion.div
          className="pricing-copy"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.6, ease }}
        >
          <p className="section-label">Rate card</p>
          <h2 id="pricing-heading" className="section-heading">
            Pricing announced at launch.
          </h2>
          <p>
            FieldQuote is not billed yet. The seats below are the intended shape —
            amounts stay TBA until launch. Join the waitlist and we email you when
            the numbers are real.
          </p>
          <a className="btn btn-outline-dark" href="#waitlist">
            Join the waitlist <ArrowRight size={18} aria-hidden="true" />
          </a>
        </motion.div>

        <motion.div
          className="rate-card"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.65, delay: reducedMotion ? 0 : 0.08, ease }}
        >
          <div className="rate-card-head">
            <span>Draft quote · not sent</span>
            <span>Launch</span>
          </div>
          <ol className="rate-card-list">
            {seats.map((seat) => (
              <li
                className="rate-card-row"
                data-quoted={seat.quoted ? 'true' : undefined}
                key={seat.code}
              >
                <span className="rate-card-code">{seat.code}</span>
                <div>
                  <h3>{seat.name}</h3>
                  <p>{seat.who}</p>
                  <span className="rate-card-includes">{seat.includes}</span>
                </div>
                <span className="rate-card-amount">{seat.amount}</span>
              </li>
            ))}
          </ol>
          <div className="rate-card-foot">
            <p>No card fields. No live prices. Confirmation email only.</p>
            <a href="#waitlist">Join the waitlist</a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
