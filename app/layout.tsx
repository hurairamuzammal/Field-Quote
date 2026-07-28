import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldQuote | Better quotes. Better jobs.",
  description: "The practical quoting and job workflow for electrical-service teams.",
  keywords: ["electrician", "electrical quoting", "job management", "EICR", "EV charger", "field service"],
  openGraph: {
    title: "FieldQuote | Better quotes. Better jobs.",
    description: "A calmer way for electrical teams to take requests, prepare quotes, collect deposits, and get jobs done.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
