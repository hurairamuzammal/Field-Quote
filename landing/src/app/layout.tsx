import type { Metadata } from 'next';
import { Manrope, Outfit, Permanent_Marker } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' });

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
    <html lang="en">
      <body className={`${manrope.variable} ${outfit.variable} ${marker.variable}`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
