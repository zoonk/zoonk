import { seededShuffle } from "@zoonk/utils/seeded-random";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getShownOrder } from "./shown-order";

const ITEMS = 500;

function itemId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function shownOrders(count: number): Set<string> {
  return new Set(
    Array.from({ length: ITEMS }, (_, index) =>
      getShownOrder({ count, seed: itemId(index) }).join(","),
    ),
  );
}

function countSameOrders(count: number, other: (seed: string) => number[]): number {
  return Array.from({ length: ITEMS }, (_, index) => itemId(index)).filter(
    (seed) => getShownOrder({ count, seed }).join(",") === other(seed).join(","),
  ).length;
}

describe(getShownOrder, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows four entries in every order but the stored one across items", () => {
    expect(shownOrders(4).size).toBe(23);
  });

  it("never shows entries in their stored order", () => {
    const stored = [0, 1, 2, 3, 4].join(",");
    expect(shownOrders(5).has(stored)).toBe(false);
  });

  it("shows an item the same way each time it's read", () => {
    const seed = "3f2b8c1e-0000-4000-8000-000000000001";
    expect(getShownOrder({ count: 6, seed })).toStrictEqual(getShownOrder({ count: 6, seed }));
  });

  it("can't be worked out from the seed with the public shuffle", () => {
    const indexes = [0, 1, 2, 3, 4];
    const publicOrder = (seed: string) => seededShuffle(indexes, seed);

    expect(countSameOrders(5, publicOrder)).toBeLessThan(ITEMS / 10);
  });

  it("changes with the server's secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "first-secret");

    const first = new Map(
      Array.from({ length: ITEMS }, (_, index) => [
        itemId(index),
        getShownOrder({ count: 5, seed: itemId(index) }),
      ]),
    );

    vi.stubEnv("BETTER_AUTH_SECRET", "second-secret");

    expect(countSameOrders(5, (seed) => first.get(seed) ?? [])).toBeLessThan(ITEMS / 10);
  });
});
