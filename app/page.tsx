import Image from "next/image";

const publicAppUrl = "https://fieldquote.bubbleapps.io/version-test/public";
const adminAppUrl = "https://fieldquote.bubbleapps.io/version-test";

function ArrowUpRight() {
  return <span aria-hidden="true">↗</span>;
}

function CheckIcon() {
  return <span className="check-icon" aria-hidden="true">✓</span>;
}

export default function Home() {
  return (
    <main>
      <section className="hero" id="top">
        <nav className="site-nav shell" aria-label="Main navigation">
          <a className="brand" href="#top" aria-label="FieldQuote home">
            <span className="brand-mark"><Image src="/logo-only.png" alt="" width={76} height={76} priority /></span>
            <span>FieldQuote</span>
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#reviews">Reviews</a>
            <a href="#faq">FAQ</a>
          </div>
          <a className="nav-login" href={adminAppUrl} target="_blank" rel="noreferrer">
            Sign in <ArrowUpRight />
          </a>
        </nav>

        <div className="hero-grid shell">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> Built for teams that build</p>
            <h1>Turn every field visit into a <em>yes.</em></h1>
            <p className="hero-intro">
              FieldQuote gives service teams one clear path from first enquiry to finished,
              paid job—without the quoting bottleneck.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={publicAppUrl} target="_blank" rel="noreferrer">
                See the customer experience <ArrowUpRight />
              </a>
              <a className="button button-text" href="#how-it-works">Explore the workflow <span aria-hidden="true">↓</span></a>
            </div>
            <div className="proof-line">
              <div className="avatar-stack" aria-hidden="true"><span>J</span><span>M</span><span>A</span><span>+</span></div>
              <p><strong>Built for field-service teams</strong><br />who want fewer loose ends.</p>
            </div>
          </div>

          <div className="hero-visual" aria-label="FieldQuote product preview">
            <div className="sun-orb" />
            <div className="dashboard-card">
              <div className="dashboard-top"><span className="mini-logo">FQ</span><span>Monday, 9:42 AM</span><span className="live-dot">Live</span></div>
              <div className="dashboard-heading"><div><p>Good morning, Alex</p><h2>Your day at a glance</h2></div><button aria-label="More options">•••</button></div>
              <div className="metric-grid">
                <div><span>New requests</span><strong>08</strong><small>↑ 3 this week</small></div>
                <div><span>Awaiting approval</span><strong>05</strong><small>£12,840 in quotes</small></div>
                <div><span>Jobs today</span><strong>06</strong><small>2 in progress</small></div>
              </div>
              <div className="request-card">
                <div className="request-icon">⌁</div>
                <div><span>NEW REQUEST</span><h3>Consumer unit inspection</h3><p>Rachel Moore · 12 minutes ago</p></div>
                <button>Review <span aria-hidden="true">→</span></button>
              </div>
              <div className="job-list">
                <p>Today&apos;s jobs <span>View calendar →</span></p>
                <div><i className="time-pill">09:30</i><b>Consumer unit upgrade</b><small>Sam J. · In progress</small><em>●</em></div>
                <div><i className="time-pill">11:15</i><b>EV charger site survey</b><small>Maya R. · Scheduled</small><em>●</em></div>
              </div>
            </div>
            <div className="quote-float"><span className="ai-spark">✦</span><div><small>AI DRAFT READY</small><strong>Quote #1084</strong><p>£1,240.00 · 4 line items</p></div><span className="quote-check">✓</span></div>
            <div className="photo-float" aria-label="Technician at work illustration"><span>⌁</span><p>On site<br /><b>right now</b></p></div>
          </div>
        </div>
        <div className="hero-strip"><div className="shell"><span>BUILT FOR ELECTRICAL WORK</span><b>Installations</b><b>Fault finding</b><b>Consumer units</b><b>EICR testing</b><b>EV charging</b></div></div>
      </section>

      <section className="workflow section shell" id="how-it-works">
        <div className="section-heading"><p className="eyebrow">ONE CALM, CONNECTED FLOW</p><h2>Less chasing. More doing.</h2><p>Every stage of the customer journey, made clear for your team and effortless for your customers.</p></div>
        <div className="workflow-grid">
          <article><span className="step-number">01</span><div className="step-icon request-step">⌁</div><h3>Customer sends a request</h3><p>They describe the work, add photos, and choose a time that works—no phone tag required.</p></article>
          <article><span className="step-number">02</span><div className="step-icon quote-step">✦</div><h3>AI prepares the first draft</h3><p>FieldQuote matches the job to your actual price book. You stay in control of every final number.</p></article>
          <article><span className="step-number">03</span><div className="step-icon payment-step">£</div><h3>They approve and pay</h3><p>Send a polished quote, take a secure deposit, and turn an accepted quote into a ready-to-schedule job.</p></article>
          <article><span className="step-number">04</span><div className="step-icon job-step">✓</div><h3>Your team gets it done</h3><p>Technicians see their work on mobile, update progress, and capture completion evidence from site.</p></article>
        </div>
      </section>

      <section className="feature-band" id="features"><div className="shell feature-layout">
        <div className="feature-copy"><p className="eyebrow light-eyebrow">YOUR EXPERTISE. MOVING FASTER.</p><h2>AI that knows its place.</h2><p>FieldQuote doesn&apos;t replace your judgement. It handles the slow first pass so your team can focus on the work that needs a human eye.</p><ul><li><CheckIcon />Grounded in <strong>your</strong> services and price book</li><li><CheckIcon />Flags assumptions and gaps before a quote goes out</li><li><CheckIcon />Every customer quote stays human-approved</li></ul><a className="button button-cream" href={adminAppUrl} target="_blank" rel="noreferrer">Explore the workspace <ArrowUpRight /></a></div>
        <div className="quote-preview"><div className="preview-label">DRAFT QUOTE <span>● HIGH CONFIDENCE</span></div><h3>Consumer unit upgrade</h3><p className="customer-name">For Rachel Moore · 14 February</p><div className="line-item"><span>18th-edition consumer unit</span><b>£480.00</b></div><div className="line-item"><span>Testing &amp; certification</span><b>£165.00</b></div><div className="line-item flagged"><span><i>!</i> Possible earthing upgrade</span><b>Needs review</b></div><div className="quote-total"><span>Estimated total</span><strong>£645.00</strong></div><div className="quote-assumption"><span>✦</span><p><b>AI note</b><br />Photo suggests legacy earthing. Confirm bonding requirements before adding materials.</p></div></div>
      </div></section>

      <section className="results section shell"><div className="results-intro"><p className="eyebrow">THE WORK SHOULD SPEAK FOR ITSELF</p><h2>Good systems make good teams look even better.</h2></div><div className="result-grid"><div><strong>Minutes, not days</strong><p>to turn a detailed enquiry into a review-ready quote</p></div><div><strong>One source of truth</strong><p>for requests, quotes, jobs, payments and follow-ups</p></div><div><strong>Built for the field</strong><p>so technicians get the right information, right when they need it</p></div></div></section>

      <section className="reviews section shell" id="reviews"><div className="section-heading centered"><p className="eyebrow">FROM THE PEOPLE DOING THE WORK</p><h2>“It finally feels like the office and field are on the same team.”</h2></div><div className="review-grid"><figure className="review-card quote-review"><div className="stars">★★★★★</div><blockquote>“We&apos;ve gone from hunting through WhatsApp and notebooks to knowing exactly where every job is. The quote drafts are a massive head start.”</blockquote><figcaption><span className="review-avatar orange">JM</span><span><b>Jamie Morton</b><small>Director, Morton Heating</small></span></figcaption></figure><figure className="review-card dark-review"><div className="stars">★★★★★</div><blockquote>“My engineers actually use it. They can see their day, update a job, take the photos and get on with it. That&apos;s the test.”</blockquote><figcaption><span className="review-avatar blue">SG</span><span><b>Sonia Green</b><small>Operations Manager, Green Spark Electrical</small></span></figcaption></figure><figure className="review-card photo-review"><div className="review-photo"><span>✦</span></div><blockquote>“The customer journey feels much more professional now. We&apos;re getting approvals while the job is still fresh in their mind.”</blockquote><figcaption><span className="review-avatar green">TR</span><span><b>Tom Reed</b><small>Owner, Reed Property Care</small></span></figcaption></figure></div><p className="review-note">Illustrative early-access feedback · Testimonials will be replaced by verified customer stories at launch.</p></section>

      <section className="faq section shell" id="faq"><div className="faq-title"><p className="eyebrow">A FEW GOOD QUESTIONS</p><h2>Clear from the start.</h2><p>Can&apos;t find what you&apos;re looking for? <a href="mailto:hello@fieldquote.co.uk">Get in touch</a>.</p></div><div className="faq-list"><details open><summary>Is FieldQuote another generic CRM?<span>+</span></summary><p>No. It&apos;s designed around the workflow service businesses actually run: enquiry, quote, deposit, job, completion, and follow-up.</p></details><details><summary>Will AI make up prices or send quotes without me?<span>+</span></summary><p>No. It works from your price book, flags anything it cannot match, and a human approves every quote before it reaches a customer.</p></details><details><summary>Can my technicians use it on their phones?<span>+</span></summary><p>Yes. The technician workspace is mobile-first, with only the jobs and actions relevant to that team member.</p></details><details><summary>How do customer payments work?<span>+</span></summary><p>Customers pay securely through Stripe Checkout. FieldQuote never asks them to enter card details inside the app.</p></details></div></section>

      <section className="final-cta"><div className="shell"><p className="eyebrow light-eyebrow">FIELDQUOTE IS COMING TO THE FIELD</p><h2>Ready to make quoting<br /><em>the easy part?</em></h2><p>See the customer experience, or sign in to the workspace if you&apos;re already on the team.</p><div><a className="button button-cream" href={publicAppUrl} target="_blank" rel="noreferrer">View public app <ArrowUpRight /></a><a className="button button-outline" href={adminAppUrl} target="_blank" rel="noreferrer">Open workspace <ArrowUpRight /></a></div></div></section>

      <footer><div className="footer-main shell"><div><a className="brand footer-brand" href="#top"><span className="brand-mark"><Image src="/logo-only.png" alt="" width={76} height={76} /></span><span>FieldQuote</span></a><p>Better quotes. Better jobs.<br />Better workdays.</p></div><div className="footer-links"><div><b>Product</b><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#reviews">Stories</a></div><div><b>Company</b><a href="mailto:hello@fieldquote.co.uk">Contact us</a><a href="#faq">FAQ</a><a href="#">About</a></div><div><b>Follow along</b><a href="#" aria-label="Instagram (coming soon)">Instagram ↗</a><a href="#" aria-label="Twitter (coming soon)">Twitter / X ↗</a><a href="#" aria-label="LinkedIn (coming soon)">LinkedIn ↗</a></div></div></div><div className="footer-bottom shell"><span>© 2026 FieldQuote. All rights reserved.</span><span><a href="#">Privacy policy</a><a href="#">Terms of use</a></span></div></footer>
    </main>
  );
}
