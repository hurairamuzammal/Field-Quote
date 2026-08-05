'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const gallery = [
  { src: '/images/images.jpeg', alt: 'Technician inspecting electrical panel', span: 7 },
  { src: '/images/images (1).jpeg', alt: 'Electrician giving thumbs up', span: 5 },
  { src: '/images/images (3).jpeg', alt: 'HVAC installation', span: 4 },
  { src: '/images/images (2).jpeg', alt: 'Modern home with solar panels', span: 8 },
  { src: '/images/images (4).jpeg', alt: 'Our engineering team', span: 12 },
];

export default function Gallery() {
  return (
    <section className="section-pad-lg" style={{ background: 'var(--cream)', color: 'var(--text-dark)' }}>
      <div className="container">
        <div className="section-label">Our Work</div>
        <h2 className="section-heading">IN THE FIELD.</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: '400px',
          gap: 'var(--space-md)'
        }}>
          {gallery.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                position: 'relative',
                gridColumn: `span ${img.span}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(11,29,44,0.7) 0%, transparent 40%)',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '2rem'
              }}>
                <span style={{
                  color: '#fff',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 'var(--text-base)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {img.alt}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
