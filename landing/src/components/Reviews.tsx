'use client';

import { motion, useReducedMotion } from 'framer-motion';

const journeyMoments = [
  {
    text: 'Describe the fault, add a photo, and open a private quote link when it is ready — no customer account required.',
    role: 'Homeowner',
    stage: 'Request → quote',
    featured: true,
  },
  {
    text: 'Accept the reviewed quote, then pay any required deposit through Stripe-hosted Checkout before the visit is locked.',
    role: 'Property manager',
    stage: 'Accept & deposit',
  },
  {
    text: 'The office assigns a technician. Scope, notes, and customer details travel with the job record — not in scattered texts.',
    role: 'Technician',
    stage: 'Assigned visit',
  },
  {
    text: 'Completion photo and notes go on the record before the final payment link is sent.',
    role: 'Homeowner',
    stage: 'Close-out',
  },
];

const motionEase = [0.16, 1, 0.3, 1] as const;

export default function Reviews() {
  const reducedMotion = Boolean(useReducedMotion());
  const featured = journeyMoments.find((moment) => moment.featured)!;
  const standard = journeyMoments.filter((moment) => !moment.featured);

  return (
    <section className="section-pad-lg" style={{ background: 'var(--cream)' }}>
      <div className="container">
        <div className="section-label">The journey</div>
        <h2 className="section-heading">WHAT THE STEPS FEEL LIKE.</h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 30 }}
            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reducedMotion ? 0 : 0.5, ease: motionEase }}
            className="glass-card"
            style={{
              flex: '1.2 1 450px',
              padding: '4rem 3rem',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-marker-face)',
                  fontSize: '6rem',
                  color: 'var(--near-black)',
                  lineHeight: 0.5,
                  marginBottom: '2.5rem',
                  marginTop: '-1rem',
                }}
              >
                &ldquo;
              </div>

              <p
                style={{
                  fontSize: 'var(--text-h3)',
                  lineHeight: 1.4,
                  color: 'var(--text-dark)',
                  fontWeight: 600,
                  marginBottom: '2rem',
                }}
              >
                {featured.text}
              </p>

              <div
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-marker-face)',
                  fontSize: '6rem',
                  color: 'var(--near-black)',
                  lineHeight: 0.5,
                  textAlign: 'right',
                  marginBottom: '3rem',
                }}
              >
                &rdquo;
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 'auto' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--dark-green)',
                    color: 'var(--lime)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    padding: '0.35rem',
                  }}
                >
                  {featured.stage}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                    }}
                  >
                    {featured.role}
                  </div>
                  <div style={{ fontSize: 'var(--text-base)', opacity: 0.6 }}>
                    Service journey
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div
            style={{
              flex: '1 1 350px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            {standard.map((moment, i) => (
              <motion.div
                key={moment.stage}
                initial={reducedMotion ? false : { opacity: 0, x: 20 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: reducedMotion ? 0 : 0.5,
                  delay: reducedMotion ? 0 : i * 0.15,
                  ease: motionEase,
                }}
                className="glass-card"
                style={{
                  padding: '2rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  flex: 1,
                }}
              >
                <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.5, color: 'var(--text-dark)' }}>
                  {moment.text}
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    marginTop: 'auto',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--cream)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-dark)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.55rem',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      padding: '0.2rem',
                    }}
                  >
                    {moment.stage.split(' ')[0]}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                      }}
                    >
                      {moment.role}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{moment.stage}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
