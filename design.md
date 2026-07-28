# FieldQuote landing page — design direction

## Purpose

FieldQuote is the operations workflow for independent electricians and small electrical-service teams. The landing page should make one practical promise: a customer enquiry can move cleanly from first description to reviewed quote, deposit, scheduled visit, and completed electrical work.

The site is not a generic AI-product landing page. It should feel like a reliable, well-organised electrical contractor: experienced, calm, clear on the details, and ready to work.

## Audience and positioning

- Primary audience: electrical contractors, owners, office managers, and supervisors running small field teams.
- Core work: electrical installations, fault finding, consumer-unit upgrades, EICR testing, emergency call-outs, lighting, rewires, and EV-charger work.
- Customer promise: faster response and professional, transparent quotes.
- Team promise: fewer missed details, less chasing, and a single trusted place to run jobs.

## Visual system

### Mood

Warm, practical, organised, and human. Avoid a cold enterprise dashboard, a black-and-purple AI aesthetic, generic gradients, stock glass panels, and overly decorative animations.

### Colour

- `Pine #1D413B`: trust, operational focus, major dark sections.
- `Warm cream #F7F4ED`: the primary background; softer than stark white.
- `Paper #FFFEFB`: readable card and page surfaces.
- `Signal orange #EF6E3B`: calls to action, priority cues, and emphasis.
- `Amber #F4B64C`: electrical-energy accent, used sparingly in illustrations and AI states.
- `Slate #68736E`: supporting copy.

Orange communicates action; it is not a decorative wash. Large dark-green surfaces balance it and keep the product grounded.

### Typography

- Display: Georgia-style editorial serif for high-value promises and section headings. It adds confidence and a considered, professional voice.
- Interface/body: a clean system sans-serif for clarity in dense product information.
- Headings use tight tracking and short lines. Body copy is plain English and never uses hype to hide a vague claim.

### Brand mark

The supplied mark has substantial transparent padding. The site uses a cropped presentation wrapper so the electric symbol is visibly substantial in the header and footer rather than appearing as a tiny icon. The wordmark stays as text for a crisp, accessible treatment until a final FieldQuote-specific logo asset is supplied.

## Page structure

1. Header: concise product navigation plus a direct workspace link.
2. Hero: clear electrical-service promise and a dashboard preview.
3. Trades strip: electrical installation, fault finding, consumer units, EICR, and EV charging.
4. Workflow: request → AI-assisted quote draft → deposit → completed job.
5. AI proof: explicit guardrails—price-book grounding and human approval, not autonomous pricing.
6. Results: useful operational outcomes, without invented statistics.
7. Reviews: illustrative early-access examples, visibly labelled until verified testimonials exist.
8. FAQ: address the questions likely to prevent adoption—CRM fit, AI safety, mobile use, and payments.
9. Final call to action and practical footer links.

## Product visuals

Until the Bubble product has real screens worth showing, the page uses custom, code-built product previews. Their content must reflect genuine product behaviour and electrical work (for example, a consumer-unit inspection or EV-charger survey), not invented capabilities. Replace them with authenticated screenshots once the relevant Bubble flows are stable.

## Motion and interaction

- Soft hover lift on buttons only.
- Anchor navigation scrolls smoothly.
- No autoplay video, parallax, carousels, or large animation libraries.
- FAQ disclosure uses native `<details>` for keyboard and screen-reader support.
- Motion should support orientation, not compete with the work.

## Accessibility and performance

- All non-decorative images require useful alt text; decorative marks have empty alt text.
- Keep orange-on-cream and body text contrast legible.
- Use semantic sections, headings in order, visible focus states supplied by the browser, and real links/buttons.
- Keep the landing page mostly server-rendered and dependency-free for a fast Vercel deployment.
- Metadata must describe FieldQuote as an electrical-service quoting and job workflow.

## Content rules

- Never imply the AI sends a quote or chooses a price alone.
- Never claim a numeric business result unless it is verified.
- Do not call the placeholder feedback “customer reviews”; label it illustrative until approval is received.
- Link the public and admin actions to the supplied Bubble URLs until custom domains are available.
