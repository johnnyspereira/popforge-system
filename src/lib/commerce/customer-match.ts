// Safe reconciliation between storefront customers and CRM contacts.
// Storefront input is unauthenticated, so it may link to an existing contact
// only on an exact email match and never overwrites CRM data. A phone-only
// match is left for a human to review: linking on it would let anyone attach
// orders (and portal access) to another person's contact.

export type ContactCandidate = { id: string; name: string | null; email: string | null; phone: string };

export type ContactDecision =
  | { action: "link"; contactId: string; fillName: boolean }
  | { action: "create" }
  | { action: "review"; conflictContactId: string };

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function decideContactMatch(byEmail: ContactCandidate | null, byPhone: ContactCandidate | null): ContactDecision {
  if (byEmail) return { action: "link", contactId: byEmail.id, fillName: !byEmail.name?.trim() };
  if (byPhone) return { action: "review", conflictContactId: byPhone.id };
  return { action: "create" };
}
