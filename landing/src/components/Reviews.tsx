'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const reviews = [
  {
    text: "FieldQuote eliminated the back-and-forth. Quotes go out in minutes instead of days. The AI is incredibly accurate.",
    author: "Sarah Jenkins",
    role: "Operations Lead",
    initials: "SJ",
    rating: 5,
    featured: true
  },
  {
    text: "The Stripe integration is flawless. We secure deposits before the van even leaves.",
    author: "Mike Thompson",
    role: "Independent Electrician",
    initials: "MT",
    rating: 4.5
  },
  {
    text: "Our team loves the workflow. Everything is tracked effortlessly from start to finish.",
    author: "David Lawrence",
    role: "Director, Luma Electrical",
    initials: "DL",
    rating: 5
  },
  {
    text: "The automated digital receipts alone saved our admin team hours every week.",
    author: "Emma Wright",
    role: "Service Manager",
    initials: "EW",
    rating: 4
  }
];

const renderStars = (rating: number, size: number = 24) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push(<Star key={i} size={size} fill="#FFB800" color="#FFB800" strokeWidth={0} />);
    } else if (i === Math.ceil(rating) && !Number.isInteger(rating)) {
      stars.push(
        <div key={i} style={{ position: 'relative', width: size, height: size }}>
          <Star size={size} color="#FFB800" strokeWidth={2} />
          <div style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden', width: '50%' }}>
            <Star size={size} fill="#FFB800" color="#FFB800" strokeWidth={0} />
          </div>
        </div>
      );
    } else {
      stars.push(<Star key={i} size={size} color="#FFB800" strokeWidth={2} />);
    }
  }
  return <div style={{ display: 'flex', gap: '4px' }}>{stars}</div>;
};

export default function Reviews() {
  const featured = reviews.find(r => r.featured)!;
  const standard = reviews.filter(r => !r.featured);

  return (
    <section className="section-pad-lg" style={{ background: 'var(--cream)' }}>
      <div className="container">
        <div className="section-label">Testimonials</div>
        <h2 className="section-heading">WHAT THEY SAY.</h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          
          {/* Featured (Left) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              flex: '1.2 1 450px',
              padding: '4rem 3rem',
              background: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.8)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Opening Quote */}
              <div style={{
                fontFamily: 'var(--font-marker)',
                fontSize: '6rem',
                color: 'var(--near-black)',
                lineHeight: 0.5,
                marginBottom: '2.5rem',
                marginTop: '-1rem'
              }}>
                &ldquo;
              </div>

              <div style={{ marginBottom: '2rem' }}>
                {renderStars(featured.rating, 36)}
              </div>

              <p style={{ fontSize: 'var(--text-h3)', lineHeight: 1.4, color: 'var(--text-dark)', fontWeight: 600, marginBottom: '2rem' }}>
                {featured.text}
              </p>

              {/* Closing Quote */}
              <div style={{
                fontFamily: 'var(--font-marker)',
                fontSize: '6rem',
                color: 'var(--near-black)',
                lineHeight: 0.5,
                textAlign: 'right',
                marginBottom: '3rem'
              }}>
                &rdquo;
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 'auto' }}>
                <div style={{
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
                  fontSize: '1.2rem'
                }}>
                  {featured.initials}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{featured.author}</div>
                  <div style={{ fontSize: 'var(--text-base)', opacity: 0.6 }}>{featured.role}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Standard Stack (Right) */}
          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {standard.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                style={{
                  padding: '2rem',
                  background: 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: 'blur(24px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07), inset 0 0 0 1px rgba(255,255,255,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  flex: 1
                }}
              >
                <div>
                  {renderStars(r.rating, 20)}
                </div>
                <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.5, color: 'var(--text-dark)' }}>
                  &ldquo;{r.text}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: 'auto' }}>
                  <div style={{
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
                    fontSize: '0.9rem'
                  }}>
                    {r.initials}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}>{r.author}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{r.role}</div>
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
