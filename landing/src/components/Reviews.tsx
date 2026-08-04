'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const reviews = [
  { 
    text: "FieldQuote eliminated the back-and-forth. Quotes go out in minutes instead of days. The AI is incredibly accurate at drafting based on our price book.", 
    author: "Sarah Jenkins", 
    role: "Operations Lead, Volt Services",
    avatar: "S",
    color: "#b7ff00"
  },
  { 
    text: "The Stripe integration is flawless. We secure deposits before the van even leaves. Highly recommend for any serious electrical contractor looking to scale.", 
    author: "Mike T.", 
    role: "Independent Electrician",
    avatar: "M",
    color: "#E2E6E3"
  },
  { 
    text: "Our team loves the workflow. It's so clean and intuitive. The floating header and minimal design make it a joy to use every single day.", 
    author: "David L.", 
    role: "Director, Luma Electrical",
    avatar: "D",
    color: "#FFFFFF"
  }
];

export default function Reviews() {
  return (
    <section className="section container" style={{ background: 'var(--text-color)', color: 'var(--bg-color)', borderRadius: '32px', padding: '6rem 4rem' }}>
      <h2 className="section-title" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>WHAT THEY SAY.</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '2rem' }}>
        {reviews.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '2.5rem',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: r.color,
                  color: r.color === '#b7ff00' ? '#000' : 'var(--text-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.2rem'
                }}>
                  {r.avatar}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{r.author}</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>{r.role}</div>
                </div>
              </div>
              <div style={{ display: 'flex', color: 'var(--accent-color)' }}>
                {[1,2,3,4,5].map(star => <Star key={star} size={16} fill="currentColor" />)}
              </div>
            </div>
            
            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.9 }}>
              "{r.text}"
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
