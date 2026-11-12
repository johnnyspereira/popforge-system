import { getSession } from '@/lib/auth/session';
import { getAuthContext } from '@/lib/auth/service';
import { hasMinRole } from '@/lib/auth/roles';

const text = (value: string, max: number) => value.replace(/\s+/g, ' ').trim().slice(0, max);
function meta(html: string, key: string) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  return (html.match(pattern)?.[1] || html.match(reverse)?.[1] || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
  const auth = await getAuthContext(session.user.id);
  if (!auth) return Response.json({ error: 'Conta inválida.' }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, 'agent')) return Response.json({ error: 'Sem permissão para importar produtos.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { url?: string } | null;
  let url: URL;
  try { url = new URL(String(body?.url || '').trim()); } catch { return Response.json({ error: 'Indique um URL válido.' }, { status: 400 }); }
  if (!['http:', 'https:'].includes(url.protocol)) return Response.json({ error: 'O URL deve começar por http:// ou https://.' }, { status: 400 });
  try {
    const makerId = url.hostname.endsWith('makerworld.com') ? url.pathname.match(/\/models\/(\d+)/)?.[1] : null;
    if (makerId) {
      const api = await fetch(`https://makerworld.com/api/v1/design-service/design/${makerId}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
      if (api.ok) {
        const model = await api.json() as { title?: string; summary?: string; coverUrl?: string; tags?: string[] };
        const description = text(String(model.summary || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '), 5000);
        return Response.json({ success: true, sourceUrl: url.toString(), data: { name: text(model.title || '', 180), description, imageUrl: model.coverUrl || '', sourceReference: url.toString(), tags: model.tags || [] } });
      }
    }
    const response = await fetch(url, { headers: { 'User-Agent': 'POPForge-Catalog-Importer/1.0' }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const html = (await response.text()).slice(0, 2_000_000);
    const title = text(meta(html, 'og:title') || meta(html, 'twitter:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '', 180);
    const description = text(meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description') || '', 5000);
    const image = meta(html, 'og:image') || meta(html, 'twitter:image');
    return Response.json({ success: true, sourceUrl: url.toString(), data: { name: title, description, imageUrl: image ? new URL(image, url).toString() : '', sourceReference: url.toString() } });
  } catch (error) {
    console.error('[product-import-url]', error);
    // Some catalogue sites (notably MakerWorld) block server-side HTML
    // requests. Still return a useful draft instead of making the import
    // button appear broken; the operator can complete image and description.
    const fallbackName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/[-_]+/g, ' ').replace(/\b\d{5,}\b/g, '').replace(/\s+/g, ' ').trim();
    if (fallbackName) return Response.json({ success: true, warning: 'O site bloqueou a leitura automática. O nome foi recuperado do URL; confirme a imagem e a descrição.', sourceUrl: url.toString(), data: { name: fallbackName.slice(0, 180), description: '', imageUrl: '', sourceReference: url.toString() } });
    return Response.json({ error: 'Não foi possível ler esse site. Confirme o link ou preencha o produto manualmente.' }, { status: 422 });
  }
}
