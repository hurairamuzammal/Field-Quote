import type { Metadata } from 'next';
import { Inter, Outfit, Permanent_Marker } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' });

export const metadata: Metadata = {
  title: 'FieldQuote — Next-Gen Quoting for Electrical Teams',
  description: 'AI-assisted quoting, automated invoicing, and real-time job tracking for independent electrical contractors. From first enquiry to paid invoice in minutes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} ${marker.variable}`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
