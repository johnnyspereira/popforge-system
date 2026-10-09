import type { Metadata } from 'next';
import PrivacyPolicyPage from '@/app/privacy/[slug]/page';

export const metadata: Metadata = {
  title: 'Política de privacidade | POPForge',
  alternates: { canonical: 'https://popforge.jpmassagem.pt/privacidade' },
  robots: { index: true, follow: true },
};

export default function PublicPrivacyPage() {
  return PrivacyPolicyPage({
    params: Promise.resolve({ slug: 'jp-massagem-999933' }),
  });
}
