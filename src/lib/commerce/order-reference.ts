/** Human-facing, stable reference. Database numbers remain internal keys. */
export function orderReference(orderNumber: number | string, createdAt?: string | Date | null) {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `PF-${year}-${String(orderNumber).padStart(6, '0')}`;
}
