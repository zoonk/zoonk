import { describe, expect, it } from "vitest";
import { getShownOrder } from "./shown-order";

const ITEMS = 500;

function shownOrders(count: number): Set<string> {
  return new Set(
    Array.from({ length: ITEMS }, (_, index) =>
      getShownOrder({
        count,
        seed: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      }).join(),
    ),
  );
}

describe(getShownOrder, () => {
  it("shows four entries in every order but the stored one across items", () => {
    expect(shownOrders(4).size).toBe(23);
  });

  it("never shows entries in their stored order", () => {
    const stored = [0, 1, 2, 3, 4].join();
    expect(shownOrders(5).has(stored)).toBe(false);
  });

  it("shows an item the same way each time it's read", () => {
    const seed = "3f2b8c1e-0000-4000-8000-000000000001";
    expect(getShownOrder({ count: 6, seed })).toEqual(getShownOrder({ count: 6, seed }));
  });
});
