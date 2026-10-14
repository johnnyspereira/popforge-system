import 'server-only';

import { emailDeliveryConfiguration, sendLocalEmail } from '@/lib/email/smtp';
import { brandedEmail } from '@/lib/email/templates';
import { orderReference } from '@/lib/commerce/order-reference';

const labels: Record<string, string> = { pending_payment: 'A aguardar pagamento', confirmed: 'Confirmada', in_production: 'Em produção', quality_check: 'Em controlo de qualidade', ready_to_ship: 'Pronta para envio', shipped: 'Enviada', delivered: 'Entregue', cancelled: 'Cancelada', paid: 'Pagamento confirmado', partially_paid: 'Pagamento parcial' };

export async function sendOrderUpdateEmail(input: { to: string | null; name: string | null; orderNumber: number; kind: 'status' | 'payment'; value: string }) {
  if (!input.to?.includes('@') || !emailDeliveryConfiguration().ready) return false;
  const label = labels[input.value] || input.value; const reference = orderReference(input.orderNumber);
  const title = input.kind === 'payment' ? 'Atualização de pagamento' : 'Atualização da encomenda';
  const message = input.kind === 'payment' ? `O estado de pagamento da encomenda ${reference} foi atualizado para “${label}”.` : `A encomenda ${reference} está agora “${label}”. Pode acompanhar todos os detalhes na sua conta POPForge.`;
  try { await sendLocalEmail({ to: input.to, profile: 'general', subject: `POPForge · ${reference} · ${label}`, text: `${message}\n\nPOPForge`, html: brandedEmail({ businessName: 'POPForge', preheader: `${reference}: ${label}`, eyebrow: 'Atualização de encomenda', title, greeting: `Olá${input.name ? `, ${input.name}` : ''}.`, message, notice: 'Não necessita de responder a este e-mail. Para apoio, contacte a POPForge.' }) }); return true; }
  catch (error) { console.error('[commerce-order-email]', error); return false; }
}
