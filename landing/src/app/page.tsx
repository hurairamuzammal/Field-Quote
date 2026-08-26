import Hero from '@/components/Hero';
import Marquee from '@/components/Marquee';
import Services from '@/components/Services';
import Gallery from '@/components/Gallery';
import Showcase from '@/components/Showcase';
import Sequence from '@/components/Sequence';
import Stats from '@/components/Stats';
import About from '@/components/About';
import Quality from '@/components/Quality';
import Team from '@/components/Team';
import Reviews from '@/components/Reviews';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main id="main-content">
      <Hero />
      <Marquee />
      <Services />
      <Gallery />
      <Showcase />
      <Sequence />
      <Stats />
      <About />
      <Quality />
      <Team />
      <Reviews />
      <FAQ />
      <Contact />
      <Footer />
    </main>
  );
}
