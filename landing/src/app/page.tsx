import Hero from '@/components/Hero';
import Marquee from '@/components/Marquee';
import Services from '@/components/Services';
import Sequence from '@/components/Sequence';
import About from '@/components/About';
import Stats from '@/components/Stats';
import Team from '@/components/Team';
import Contact from '@/components/Contact';
import Reviews from '@/components/Reviews';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      {/* SECTION 1: Cream/White BG */}
      <section className="snap-section" style={{ background: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Hero />
        </div>
        <Marquee />
      </section>

      {/* SECTION 2: Lime Green BG */}
      <section className="snap-section" style={{ background: 'var(--accent-color)', color: '#121514' }}>
        <Team />
        <Stats />
      </section>

      {/* SECTION 3: Deep Slate/Black BG */}
      <section className="snap-section" style={{ background: '#121514', color: '#F6F7F6' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '4rem 0' }}>
          <Services />
          <Sequence />
        </div>
      </section>

      {/* SECTION 4: Cream/White BG */}
      <section className="snap-section" style={{ background: 'var(--bg-color)', color: 'var(--text-color)', justifyContent: 'space-between' }}>
        <div style={{ paddingTop: '8rem' }}>
          <About />
          <Reviews />
          <Contact />
        </div>
        <Footer />
      </section>
    </main>
  );
}
