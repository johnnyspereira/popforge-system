import { describe, expect, it } from "vitest";
import { canTransitionOrder, nextOrderStatuses, stockEffectFor } from "./order-status";

describe("order status transitions", () => {
  it("follows the fulfilment flow", () => {
    expect(canTransitionOrder("pending_payment", "confirmed")).toBe(true);
    expect(canTransitionOrder("confirmed", "in_production")).toBe(true);
    expect(canTransitionOrder("in_production", "ready_to_ship")).toBe(true);
    expect(canTransitionOrder("ready_to_ship", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
  });

  it("rejects backwards and terminal moves", () => {
    expect(canTransitionOrder("delivered", "pending_payment")).toBe(false);
    expect(canTransitionOrder("cancelled", "confirmed")).toBe(false);
    expect(canTransitionOrder("shipped", "cancelled")).toBe(false);
    expect(canTransitionOrder("pending_payment", "shipped")).toBe(false);
  });

  it("never targets legacy payment-like statuses", () => {
    for (const status of ["draft", "pending_payment", "confirmed", "paid", "in_production"]) {
      expect(nextOrderStatuses(status)).not.toContain("paid");
      expect(nextOrderStatuses(status)).not.toContain("refunded");
    }
  });

  it("treats legacy paid orders like confirmed ones", () => {
    expect(nextOrderStatuses("paid")).toEqual(nextOrderStatuses("confirmed"));
  });

  it("rejects unknown statuses", () => {
    expect(canTransitionOrder("pending_payment", "lost")).toBe(false);
    expect(nextOrderStatuses("lost")).toEqual([]);
  });
});

describe("stock effects", () => {
  it("releases a reservation on cancellation", () => {
    expect(stockEffectFor("cancelled", "reserved")).toBe("release");
  });

  it("consumes a reservation when the order leaves the workshop", () => {
    expect(stockEffectFor("shipped", "reserved")).toBe("consume");
    expect(stockEffectFor("delivered", "reserved")).toBe("consume");
  });

  it("is idempotent once the reservation is settled", () => {
    expect(stockEffectFor("cancelled", "released")).toBeNull();
    expect(stockEffectFor("cancelled", "consumed")).toBeNull();
    expect(stockEffectFor("shipped", "consumed")).toBeNull();
    expect(stockEffectFor("cancelled", "none")).toBeNull();
  });

  it("leaves stock alone for intermediate states", () => {
    expect(stockEffectFor("in_production", "reserved")).toBeNull();
    expect(stockEffectFor("confirmed", "reserved")).toBeNull();
  });
});
