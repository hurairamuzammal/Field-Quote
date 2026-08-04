# FieldQuote landing page — design direction

## Purpose

FieldQuote is the operations workflow for independent electricians and small electrical-service teams. The landing page demonstrates that a customer enquiry can move cleanly from first description to reviewed quote, deposit, scheduled visit, and completed electrical work.

## Visual system

### Mood
Minimal, hyper-modern, fluid, and confident. The aesthetic draws inspiration from high-end digital agencies (like Obys) but applies it to practical field service tools.

### Colour
- `Lime Green #b7ff00`: The primary accent color for calls to action, highlights, and energy. It provides a striking, high-contrast pop.
- `Off-White #F6F7F6`: The primary background color. Soft and clean, ensuring the high-contrast elements stand out.
- `Deep Slate #121514`: Used for text, major dark components, and inverted elements. It provides a severe, premium contrast against the off-white and lime green.

### Typography
- **Display (Headings)**: `Outfit` (or similar clean geometric sans-serif) used at massive, fluid sizes (up to `9rem` or `12vw`). Headings should be bold, tightly tracked, and commanding.
- **Interface/Body**: `Inter` for clean, dense product information and paragraph readability.

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
