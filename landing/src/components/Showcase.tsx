'use client';

import {
  CalendarCheck,
  Camera,
  CreditCard,
  FileCheck2,
  Inbox,
  Receipt,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-80px' as const };

const evidence = [
  {
    icon: Inbox,
    title: 'Request received',
    detail: 'Description, timing, address, and media are kept together.',
    state: 'new',
  },
  {
    icon: FileCheck2,
    title: 'Quote reviewed',
    detail: 'The service team checks the prepared scope before sending.',
    state: 'sent',
  },
  {
    icon: CreditCard,
    title: 'Deposit secured',
    detail: 'Acceptance and deposit use Stripe-hosted checkout.',
    state: 'accepted',
  },
  {
    icon: CalendarCheck,
    title: 'Visit confirmed',
    detail: 'A person assigns the technician and appointment window.',
    state: 'scheduled',
  },
  {
    icon: Camera,
    title: 'Work evidenced',
    detail: 'Completion requires job notes and at least one photo.',
    state: 'completed',
  },
  {
    icon: Receipt,
    title: 'Final balance',
    detail: 'A secure final-payment link is sent when a balance remains.',
    state: 'final',
  },
];

export default function Showcase() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section className="operations section-pad-lg" aria-labelledby="operations-heading">
      <div className="container operations-grid">
        <motion.div
          className="operations-copy"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.6, ease }}
        >
          <p className="section-label">The system behind the service</p>
          <h2 id="operations-heading" className="section-heading">
            A proper record, not a paper trail.
          </h2>
          <p>
            Each handoff has a clear state. That means the quote, payment, appointment,
            field update, and completion evidence belong to the same job instead of
            living in disconnected messages.
          </p>
        </motion.div>

        <motion.div
          className="evidence-ledger"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.65, delay: reducedMotion ? 0 : 0.1, ease }}
        >
          <div className="ledger-head">
            <span>Customer journey record</span>
            <span>Operational</span>
          </div>
          <ol className="ledger-list">
            {evidence.map((item) => (
              <li className="ledger-row" key={item.title}>
                <span className="ledger-icon" aria-hidden="true">
                  <item.icon size={19} strokeWidth={1.8} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
                <span className="ledger-state">{item.state}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}
