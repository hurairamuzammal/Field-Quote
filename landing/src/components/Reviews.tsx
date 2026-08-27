'use client';

import { HardHat, UserRound, UserRoundCheck, type LucideIcon } from 'lucide-react';
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

const ROLE_ICONS: Record<string, LucideIcon> = {
  Homeowner: UserRound,
  'Property manager': UserRoundCheck,
  Technician: HardHat,
};

function JourneyAvatar({
  role,
  size = 'standard',
  index = 0,
  reducedMotion,
}: {
  role: string;
  size?: 'featured' | 'standard';
  index?: number;
  reducedMotion: boolean;
}) {
  const Icon = ROLE_ICONS[role] ?? UserRound;
  const iconSize = size === 'featured' ? 28 : 20;

  return (
    <motion.div
      className={
        size === 'featured'
          ? 'journey-avatar journey-avatar--featured'
          : 'journey-avatar'
      }
      animate={
        reducedMotion
          ? undefined
          : {
              y: [0, -5, 0],
              boxShadow:
                size === 'featured'
                  ? [
                      '0 10px 28px rgba(11, 29, 44, 0.22)',
                      '0 14px 34px rgba(0, 224, 196, 0.28)',
                      '0 10px 28px rgba(11, 29, 44, 0.22)',
                    ]
                  : undefined,
            }
      }
      transition={{
        duration: 2.8,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: index * 0.35,
      }}
      aria-hidden="true"
    >
      <motion.span
        className="journey-avatar-icon"
        animate={reducedMotion ? undefined : { rotate: [0, -5, 5, 0] }}
        transition={{
          duration: 3.6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: index * 0.35 + 0.4,
        }}
      >
        <Icon size={iconSize} strokeWidth={2.2} aria-hidden="true" />
      </motion.span>
    </motion.div>
  );
}

export default function Reviews() {
  const reducedMotion = Boolean(useReducedMotion());
  const featured = journeyMoments.find((moment) => moment.featured)!;
  const standard = journeyMoments.filter((moment) => !moment.featured);

  return (
    <section className="section-pad-lg">
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
                  color: 'var(--quote-mark)',
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
                  color: 'var(--quote-mark)',
                  lineHeight: 0.5,
                  textAlign: 'right',
                  marginBottom: '3rem',
                }}
              >
                &rdquo;
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 'auto' }}>
                <JourneyAvatar
                  role={featured.role}
                  size="featured"
                  index={0}
                  reducedMotion={reducedMotion}
                />
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
                  <JourneyAvatar
                    role={moment.role}
                    index={i + 1}
                    reducedMotion={reducedMotion}
                  />
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
