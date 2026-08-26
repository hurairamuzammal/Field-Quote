import { redirect } from 'next/navigation';
import { SITE_LINKS } from '@/lib/site';

export default function QuotePage() {
  redirect(SITE_LINKS.requestQuote);
}
