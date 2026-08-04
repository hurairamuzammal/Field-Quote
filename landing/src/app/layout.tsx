import type { Metadata } from 'next';
import { Inter, Outfit, Permanent_Marker } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import CustomCursor from '@/components/CustomCursor';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' });

export const metadata: Metadata = {
  title: 'FieldQuote | Next-Gen Quoting for Field Operations',
  description: 'Lightweight quoting for field technicians. A customer enquiry can move cleanly from first description to reviewed quote.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} ${marker.variable}`}>
        <CustomCursor />
        <Header />
        {children}
      </body>
    </html>
  );
}
