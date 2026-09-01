'use client';

import { Camera, Check, Wrench } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-80px' as const };

const fadeUp = (reducedMotion: boolean, delay = 0) => ({
  initial: reducedMotion ? false : { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: viewOnce,
  transition: { duration: 0.6, delay: reducedMotion ? 0 : delay, ease },
});

export default function Gallery() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section id="proof" className="field-proof section-pad-lg" aria-labelledby="proof-heading">
      <div className="container">
        <motion.div className="proof-header" {...fadeUp(reducedMotion)}>
          <div>
            <p className="section-label section-label--dark">The product in use</p>
            <h2 id="proof-heading" className="section-heading">
              Real boards. Real quotes.
            </h2>
          </div>
          <p className="section-intro">
            These are FieldQuote screens from the working app: the request inbox,
            the quote the admin opens, and the technician job list that closes
            the visit with notes and a photo.
          </p>
        </motion.div>

        <div className="proof-grid">
          <motion.figure
            className="proof-image proof-image--primary"
            {...fadeUp(reducedMotion, 0.08)}
          >
            <Image
              src="/images/product/admin-quotes.jpg"
              alt="FieldQuote admin quotes board with customer rows, status pills, and subtotals"
              fill
              sizes="(max-width: 700px) 100vw, 58vw"
              quality={82}
            />
            <figcaption>Admin quotes board</figcaption>
          </motion.figure>

          <motion.figure className="proof-image" {...fadeUp(reducedMotion, 0.14)}>
            <Image
              src="/images/product/quote-modal.jpg"
              alt="Quote editor for Priya Shah with line items, quantities, and Save changes"
              fill
              sizes="(max-width: 700px) 100vw, 38vw"
              quality={84}
            />
            <figcaption>Quote editor</figcaption>
          </motion.figure>

          <motion.div className="proof-record" {...fadeUp(reducedMotion, 0.2)}>
            <div>
              <span className="proof-record-label">Field close-out</span>
              <h3>Same job on the phone.</h3>
            </div>
            <ul className="proof-record-list">
              <li>
                <Wrench size={16} aria-hidden="true" /> Technician notes added
              </li>
              <li>
                <Camera size={16} aria-hidden="true" /> Completion photo required
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> Job status confirmed
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
