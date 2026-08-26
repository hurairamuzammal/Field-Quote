import { redirect } from 'next/navigation';
import { SITE_LINKS } from '@/lib/site';

export default function AdminPage() {
  redirect(SITE_LINKS.staffLogin);
}
