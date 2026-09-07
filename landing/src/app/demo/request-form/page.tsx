import type { Metadata } from 'next';
import RequestFormDemo from './RequestFormDemo';

export const metadata: Metadata = {
  title: 'Request form — proposed UI',
  description:
    'An interactive mockup of the improved quote-request form: problem first, contact details second, voice note as a first-class path.',
  robots: { index: false, follow: false },
};

export default function RequestFormDemoPage() {
  return <RequestFormDemo />;
}
