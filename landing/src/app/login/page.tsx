import { redirect } from 'next/navigation';
import { SITE_LINKS } from '@/lib/site';

export default function LoginPage() {
  redirect(SITE_LINKS.staffLogin);
}
