import { describe, expect, it } from "vitest";
import { decideContactMatch } from "./customer-match";

const contact = (id: string, overrides: Partial<{ name: string | null; email: string | null; phone: string }> = {}) => ({ id, name: "Cliente", email: "a@b.pt", phone: "+351910000000", ...overrides });

describe("storefront contact reconciliation", () => {
  it("links on an exact email match", () => {
    expect(decideContactMatch(contact("c1"), null)).toEqual({ action: "link", contactId: "c1", fillName: false });
  });

  it("prefers the email match when the phone belongs to someone else", () => {
    expect(decideContactMatch(contact("c1"), contact("c2"))).toMatchObject({ action: "link", contactId: "c1" });
  });

  it("only fills a missing name, never replaces one", () => {
    expect(decideContactMatch(contact("c1", { name: "" }), null)).toMatchObject({ fillName: true });
    expect(decideContactMatch(contact("c1", { name: "Ana" }), null)).toMatchObject({ fillName: false });
  });

  it("does not link on a phone-only match", () => {
    expect(decideContactMatch(null, contact("c2", { email: null }))).toEqual({ action: "review", conflictContactId: "c2" });
  });

  it("creates a contact when nothing matches", () => {
    expect(decideContactMatch(null, null)).toEqual({ action: "create" });
  });
});
