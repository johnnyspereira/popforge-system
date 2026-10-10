import type { Metadata } from 'next';
import type { RowDataPacket } from 'mysql2';
import { PublicBusinessPage } from './site/[slug]/page';
import { redirect } from 'next/navigation';
import { getDefaultPublicBusinessSlug, getPublicBusinessSite } from '@/lib/public-site/server';
import { selectRows } from '@/lib/mysql/db';

interface CountRow extends RowDataPacket { total: number }

export async function generateMetadata(): Promise<Metadata> {
  const slug = await getDefaultPublicBusinessSlug();
  const site = slug ? await getPublicBusinessSite(slug) : null;
  const name = site?.account.name || 'POPForge';
  const description = site?.settings.hero_subtitle || 'Massagens e experiências de bem-estar por marcação.';
  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://popforge.jpmassagem.pt').replace(/\/$/, '');
  const image = site?.settings.hero_image_url || '/site-assets/jp-massagem-hero-v1.png';
  return {
    title: name,
    description,
    alternates: { canonical: origin },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', locale: 'pt_PT', url: origin, title: name, description, images: [image] },
    twitter: { card: 'summary_large_image', title: name, description, images: [image] },
  };
}

export default async function RootPage() {
  const slug = await getDefaultPublicBusinessSlug();
  // The domain root is the business website, never the legacy directory.
  if (!slug) {
    let installed = false;
    try {
      const users = await selectRows<CountRow[]>('SELECT COUNT(*) AS total FROM app_users');
      installed = Number(users[0]?.total || 0) > 0;
    } catch {
      installed = false;
    }
    redirect(installed ? '/login' : '/install');
  }
  return <PublicBusinessPage params={Promise.resolve({ slug })} />;
}
