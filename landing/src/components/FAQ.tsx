'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-80px' as const };

const faqs = [
  {
    q: 'What happens after I submit a request?',
    a: 'Your description, contact details, preferred timing, and any uploaded media are grouped into one service request. The team reviews it, prepares the scope, and sends a private quote link when it is ready.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. Customers use secure, tokenized links to review a quote and continue to payment. You do not need to remember a password or access a public customer database.',
  },
  {
    q: 'Can I include photos or a voice note?',
    a: 'Yes. The request flow supports job photos and voice input so you can show the issue and explain what is happening without fitting everything into a short text box.',
  },
  {
    q: 'What does FieldQuote cost?',
    a: 'Seat prices are not published yet. The landing page shows a draft rate card (Solo, Crew, Dispatch) with amounts marked TBA. Join the waitlist and you get a confirmation email when launch pricing is announced. There is nothing to pay on this site.',
  },
  {
    q: 'When do I pay?',
    a: 'If the quote requires a deposit, it is collected after you accept and before the job is scheduled. When the work is complete, a separate secure payment link is sent for any remaining balance.',
  },
  {
    q: 'How is the technician visit scheduled?',
    a: 'A member of the service team assigns the technician and confirms the appointment window after the quote is accepted and the required deposit is paid.',
  },
  {
    q: 'What do I receive when the work is finished?',
    a: 'The job record includes completion notes and at least one completion photo. You also receive completion confirmation and a final-payment request when a balance remains.',
  },
  {
    q: 'How are card details handled?',
    a: 'Card entry happens on Stripe-hosted Checkout. FieldQuote does not collect or store card fields, and payment status is confirmed by Stripe before the workflow moves forward.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section id="faq" className="faq section-pad-lg" aria-labelledby="faq-heading">
      <div className="container faq-grid">
        <motion.div
          className="faq-heading"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.6, ease }}
        >
          <p className="section-label section-label--dark">Before you request</p>
          <h2 id="faq-heading" className="section-heading">
            Straight answers.
          </h2>
          <p>
            The online workflow is designed to make the service clearer, not to hide
            important details behind automation.
          </p>
        </motion.div>

        <div className="faq-list">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            const questionId = `faq-question-${i}`;
            const panelId = `faq-panel-${i}`;

            return (
              <motion.div
                className="faq-item"
                key={faq.q}
                initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewOnce}
                transition={{
                  duration: 0.5,
                  delay: reducedMotion ? 0 : i * 0.04,
                  ease,
                }}
              >
                <button
                  id={questionId}
                  className="faq-question"
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  {faq.q}
                  <ChevronDown size={22} aria-hidden="true" />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      className="faq-answer"
                      role="region"
                      aria-labelledby={questionId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.26,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <p>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
