import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PopforgePublicSite } from '@/components/website/popforge-public-site';
import { getPublicBusinessSite } from '@/lib/public-site/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicBusinessSite(slug);

  if (!site) {
    return {
      title: 'Site indisponível',
      robots: { index: false, follow: false },
    };
  }

  const description =
    site.settings.seo_description ||
    site.settings.hero_subtitle ||
    site.settings.about_text ||
    undefined;

  return {
    title: site.settings.seo_title || site.account.name,
    description,
    openGraph: {
      title: site.settings.seo_title || site.account.name,
      description,
      images: site.settings.hero_image_url
        ? [site.settings.hero_image_url]
        : site.account.logo_url
          ? [site.account.logo_url]
          : undefined,
    },
  };
}

async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicBusinessSite(slug);

  if (!site) notFound();

  // Public business pages remain configurable through Website Builder.
  return <PopforgePublicSite site={site} />;
}

export default PublicBusinessPage;
