import Hero from '@/components/Hero';
import Marquee from '@/components/Marquee';
import Services from '@/components/Services';
import Sequence from '@/components/Sequence';
import Stats from '@/components/Stats';
import About from '@/components/About';
import Quality from '@/components/Quality';
import Team from '@/components/Team';
import Reviews from '@/components/Reviews';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import Gallery from '@/components/Gallery';
import Showcase from '@/components/Showcase';

export default function Home() {
  return (
    <main>
      {/* 1. Hero — Cream */}
      <Hero />

      {/* 2. Marquee — Cream border */}
      <Marquee />

      {/* 3. Services — Dark green */}
      <Services />

      {/* 4. Gallery — Cream */}
      <Gallery />

      {/* 5. Showcase — Dark green */}
      <Showcase />

      {/* 6. How It Works — Cream */}
      <Sequence />

      {/* 7. Stats — Gradient */}
      <Stats />

      {/* 8. About / The Standard — Cream */}
      <About />

      {/* 8.5 Quality & Pricing — Cream */}
      <Quality />

      {/* 9. Team — Dark green */}
      <Team />

      {/* 8. Reviews — Cream */}
      <Reviews />

      {/* 9. FAQ — Dark green */}
      <FAQ />

      {/* 10. Contact — Cream */}
      <Contact />

      {/* 11. Footer — Near-black */}
      <Footer />
    </main>
  );
}
