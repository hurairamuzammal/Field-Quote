import type { Metadata } from 'next';
import { Manrope, Outfit, Permanent_Marker } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import { ThemeProvider } from '@/components/ThemeProvider';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' });

const themeInit = `(function(){try{var t=localStorage.getItem('fq-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'FieldQuote — Electrical Work, Quoted and Scheduled Clearly',
  description: 'Request electrical work, review a professionally prepared quote, pay securely, and receive clear updates through completion.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${manrope.variable} ${outfit.variable} ${marker.variable}`}>
        <ThemeProvider>
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
