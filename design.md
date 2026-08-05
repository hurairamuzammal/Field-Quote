# FieldQuote landing page — design direction

## Purpose

FieldQuote is the operations workflow for independent electricians and small electrical-service teams. The landing page demonstrates that a customer enquiry can move cleanly from first description to reviewed quote, deposit, scheduled visit, and completed electrical work.

## Visual system

### Mood

Minimal, hyper-modern, fluid, and confident. The aesthetic draws inspiration from high-end digital agencies (like Obys) but applies it to practical field service tools.

### Colour

- `Neon Cyan / Teal Accent #00E0C4`: A vibrant, energetic cyan/teal accent used for calls to action, glowing spotlight effects, and high-impact cards.
- `Cream #F7F9FC`: The primary base background color for the application. Soft and clean.
- `Deep Navy Blue #0B1D2C`: Used for text, massive typography blocks, and dark solid components. Provides a severe, premium contrast.

### Typography

- **Display (Headings)**: `Outfit` at massive, fluid sizes. Tightly tracked, heavy weights, and commanding.
- **Accent (Headings)**: `Permanent Marker` used for high-impact card headings (white-on-dark), massive fluid sizing (`clamp(2.5rem, 4vw, 3.5rem)`).
- **Interface/Body**: `Manrope` for clear, modern paragraph readability. Base font sizes have been increased for better legibility and a bolder presence.

### Motion and interaction

- **Super Fluid**: Use `framer-motion` for buttery smooth easings (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Magnetic/Lift Hovers**: Buttons and cards should have subtle magnetic pulls or lift-and-invert states when hovered.
- **Live Scrolling**: Continuous marquee text to communicate energy and volume of services.
- **Scroll Reveals**: Components should smoothly fade and slide up as they enter the viewport.
- **Glassmorphism**: Floating headers or panels use `backdrop-blur` to maintain depth over scrolling content.

## Page structure

1. **Floating Header**: Sticky glassmorphic nav with "Sign Up" and "Book an Appointment".
2. **Hero**: Huge typography statement.
3. **Marquee**: Live scrolling text of electrical services.
4. **Stats/Numbers**: Animated counting statistics (e.g., customers served).
5. **Services**: Animated cards for Consumer Units, EICR, EV Chargers, Fault Finding.
6. **Workflow Tabs**: Process steps (AI Draft → Review → Deposit → Done).
7. **Team/Careers**: Showcasing 250+ trained staff and career opportunities.
8. **Reviews**: Social-media style testimonial cards with profile avatars and star ratings.
9. **Contact/HQ**: Headquarters details, emails, and certifications.
10. **Footer**: Massive typography closer.
