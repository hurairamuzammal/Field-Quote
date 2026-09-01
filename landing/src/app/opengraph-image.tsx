import { ImageResponse } from 'next/og';

export const alt =
  'FieldQuote — electrical work, quoted and scheduled clearly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#0B1D2C',
          color: '#F0F4F8',
          fontFamily: 'Georgia, Times New Roman, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #00E0C4',
              color: '#00E0C4',
              fontSize: 28,
              fontWeight: 700,
              fontFamily: 'Arial, sans-serif',
            }}
          >
            FQ
          </div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              textTransform: 'uppercase',
              fontFamily: 'Arial, sans-serif',
              color: '#00E0C4',
            }}
          >
            FieldQuote
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: -2,
              fontFamily: 'Arial, sans-serif',
              maxWidth: 920,
            }}
          >
            Electrical work, quoted and scheduled clearly.
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: 'rgba(240,244,248,0.72)',
              fontFamily: 'Arial, sans-serif',
              maxWidth: 780,
            }}
          >
            Request → reviewed quote → deposit → job. Pricing announced at
            launch.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'Arial, sans-serif',
            fontSize: 18,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: 'rgba(240,244,248,0.55)',
          }}
        >
          <span>Join the waitlist</span>
          <span style={{ color: '#00E0C4' }}>Request → Quote → Visit</span>
        </div>
      </div>
    ),
    size,
  );
}
