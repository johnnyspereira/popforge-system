// Order and payment state rules shared by the API and the backoffice UI.
// Order status (fulfilment) and payment status are independent: an order can
// be confirmed and in production while payment is still pending.

export const ORDER_STATUSES = [
  "draft", "pending_payment", "confirmed", "paid", "in_production", "quality_check",
  "ready_to_ship", "shipped", "delivered", "cancelled", "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "partially_paid", "refunded", "failed", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type StockState = "none" | "reserved" | "released" | "consumed";
export type StockEffect = "release" | "consume";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Rascunho",
  pending_payment: "Pendente",
  confirmed: "Confirmada",
  paid: "Confirmada (legado)",
  in_production: "Em produção",
  quality_check: "Controlo de qualidade",
  ready_to_ship: "Pronta",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
  refunded: "Reembolsada (legado)",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  partially_paid: "Parcialmente pago",
  refunded: "Reembolsado",
  failed: "Falhado",
  cancelled: "Cancelado",
};

// `paid` and `refunded` are legacy order statuses kept so existing rows stay
// valid. New transitions never target them: payment lives in payment_status.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["in_production", "ready_to_ship", "cancelled"],
  paid: ["in_production", "ready_to_ship", "cancelled"],
  in_production: ["quality_check", "ready_to_ship", "cancelled"],
  quality_check: ["in_production", "ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function nextOrderStatuses(current: string): readonly OrderStatus[] {
  return isOrderStatus(current) ? TRANSITIONS[current] : [];
}

export function canTransitionOrder(current: string, next: string) {
  return isOrderStatus(next) && nextOrderStatuses(current).includes(next);
}

/** Stock consequence of moving an order to `next`, given its current stock state. */
export function stockEffectFor(next: OrderStatus, stockState: StockState): StockEffect | null {
  if (stockState !== "reserved") return null;
  if (next === "cancelled") return "release";
  if (next === "shipped" || next === "delivered") return "consume";
  return null;
}
