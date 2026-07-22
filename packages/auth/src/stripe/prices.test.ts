import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStripePrices } from "./prices";

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));

vi.mock("stripe", () => ({
  default: class MockStripe {
    prices = { list: mockList };
  },
}));

describe(getStripePrices, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty map for empty lookup keys", async () => {
    const result = await getStripePrices([], "usd");
    expect(result.size).toBe(0);
  });

  it("does not contact Stripe during E2E tests", async () => {
    vi.stubEnv("E2E_TESTING", "true");

    const result = await getStripePrices(["plus_monthly"], "usd");

    expect(result.size).toBe(0);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns prices with currency options when available", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          currency: "usd",
          currency_options: { brl: { unit_amount: 2990 } },
          lookup_key: "plus_monthly",
          unit_amount: 999,
        },
      ],
    });

    const result = await getStripePrices(["plus_monthly"], "brl");

    expect(result.get("plus_monthly")).toStrictEqual({ amount: 2990, currency: "brl" });
  });

  it("falls back to default price when currency option is unavailable", async () => {
    mockList.mockResolvedValue({
      data: [
        { currency: "usd", currency_options: {}, lookup_key: "plus_monthly", unit_amount: 999 },
      ],
    });

    const result = await getStripePrices(["plus_monthly"], "xyz");

    expect(result.get("plus_monthly")).toStrictEqual({ amount: 999, currency: "usd" });
  });

  it("handles multiple lookup keys", async () => {
    mockList.mockResolvedValue({
      data: [
        { currency: "usd", currency_options: {}, lookup_key: "plus_monthly", unit_amount: 999 },
        { currency: "usd", currency_options: {}, lookup_key: "plus_yearly", unit_amount: 9999 },
      ],
    });

    const result = await getStripePrices(["plus_monthly", "plus_yearly"], "usd");

    expect(result.size).toBe(2);
    expect(result.get("plus_monthly")?.amount).toBe(999);
    expect(result.get("plus_yearly")?.amount).toBe(9999);
  });

  it("skips prices without lookup_key", async () => {
    mockList.mockResolvedValue({
      data: [{ currency: "usd", currency_options: {}, lookup_key: null, unit_amount: 999 }],
    });

    const result = await getStripePrices(["plus_monthly"], "usd");
    expect(result.size).toBe(0);
  });

  it("lets callers handle provider failures outside their cache boundary", async () => {
    const providerError = new Error("Stripe unavailable");
    mockList.mockRejectedValueOnce(providerError);

    await expect(getStripePrices(["plus_monthly"], "usd")).rejects.toBe(providerError);
  });
});
