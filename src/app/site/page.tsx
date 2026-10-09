import { redirect } from 'next/navigation';

// Legacy directory route. POPForge has a single public site at the root.
export default function LegacySiteDirectoryRedirect() {
  redirect('/');
}
