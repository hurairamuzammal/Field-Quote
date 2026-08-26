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
            <p className="section-label section-label--dark">The on-site outcome</p>
            <h2 id="proof-heading" className="section-heading">
              Digital clarity. Physical work.
            </h2>
          </div>
          <p className="section-intro">
            The workflow ends with a technician at the property and a documented
            result. Completion photos and notes connect the on-site work to the same
            job record that began with the original request.
          </p>
        </motion.div>

        <div className="proof-grid">
          <motion.figure
            className="proof-image proof-image--primary"
            {...fadeUp(reducedMotion, 0.08)}
          >
            <Image
              src="/images/images.jpeg"
              alt="Technician inspecting an electrical installation"
              fill
              sizes="(max-width: 700px) 100vw, 58vw"
            />
            <figcaption>Electrical installation inspection</figcaption>
          </motion.figure>

          <motion.figure className="proof-image" {...fadeUp(reducedMotion, 0.14)}>
            <Image
              src="/images/images (1).jpeg"
              alt="Electrician beside an electrical distribution board"
              fill
              sizes="(max-width: 700px) 100vw, 38vw"
            />
            <figcaption>Distribution board service</figcaption>
          </motion.figure>

          <motion.div className="proof-record" {...fadeUp(reducedMotion, 0.2)}>
            <div>
              <span className="proof-record-label">Completion record</span>
              <h3>Proof before close-out.</h3>
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
