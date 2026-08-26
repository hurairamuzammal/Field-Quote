'use client';

import { Home, ShieldCheck, BatteryCharging, Zap } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

const ease = [0.16, 1, 0.3, 1] as const;
const viewOnce = { once: true, margin: '-80px' as const };

const services = [
  {
    icon: Zap,
    title: 'Fault finding',
    desc: 'Describe the symptoms and attach photos so the team can understand the issue before the visit.',
  },
  {
    icon: Home,
    title: 'Consumer unit work',
    desc: 'Clear quoting for inspections, replacements, and upgrades, with the agreed scope recorded before work begins.',
  },
  {
    icon: ShieldCheck,
    title: 'EICR testing',
    desc: 'Arrange an electrical installation condition report and keep the appointment and job record in one place.',
  },
  {
    icon: BatteryCharging,
    title: 'EV charger installs',
    desc: 'Submit property details for review, receive a prepared quote, and confirm the installation visit online.',
  },
];

export default function Services() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section id="services" className="services section-pad-lg" aria-labelledby="services-heading">
      <div className="container">
        <motion.div
          className="services-header"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewOnce}
          transition={{ duration: 0.6, ease }}
        >
          <div>
            <p className="section-label section-label--dark">Electrical services</p>
            <h2 id="services-heading" className="section-heading">
              Practical work. Clear next steps.
            </h2>
          </div>
          <p className="section-intro">
            Start with the job, not a sales call. The request captures the details the
            team needs to prepare the right scope and arrange the visit.
          </p>
        </motion.div>

        <div className="services-layout">
          <motion.figure
            className="services-photo"
            initial={reducedMotion ? false : { opacity: 0, scale: 1.04 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewOnce}
            transition={{ duration: 0.75, ease }}
          >
            <Image
              src="/images/panel-work.jpg"
              alt="Electrician working on a labelled industrial distribution panel"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
            />
            <figcaption>
              Electrical work moves from a documented request to an agreed on-site visit.
            </figcaption>
          </motion.figure>

          <ol className="service-list">
            {services.map((service, index) => (
              <motion.li
                className="service-row"
                key={service.title}
                initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewOnce}
                transition={{
                  duration: 0.55,
                  delay: reducedMotion ? 0 : index * 0.08,
                  ease,
                }}
              >
                <span className="service-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="service-icon" aria-hidden="true">
                  <service.icon size={21} strokeWidth={1.8} />
                </span>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
