import { cookies } from 'next/headers';
import NewNotePageClient from './NewNotePageClient';
import { AUTH_BOOTSTRAP_COOKIE_NAME, readAuthBootstrapFromCookieValue } from '@/lib/auth-bootstrap';

export default async function NewNotePage() {
  const cookieStore = await cookies();
  const initialAuthBootstrap = readAuthBootstrapFromCookieValue(cookieStore.get(AUTH_BOOTSTRAP_COOKIE_NAME)?.value);

  return <NewNotePageClient initialAuthBootstrap={initialAuthBootstrap} />;
}
