import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStripePrices } from "./stripe-prices";

const { mockList } = vi.hoisted(() => ({
  mockList: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    prices = { list: mockList };
  },
}));

describe("getStripePrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map for empty lookup keys", async () => {
    const result = await getStripePrices([], "usd");
    expect(result.size).toBe(0);
  });

  it("returns prices with currency options when available", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          currency: "usd",
          currency_options: {
            brl: { unit_amount: 2990 },
          },
          lookup_key: "hobby_monthly",
          unit_amount: 999,
        },
      ],
    });

    const result = await getStripePrices(["hobby_monthly"], "brl");

    expect(result.get("hobby_monthly")).toEqual({
      amount: 2990,
      currency: "brl",
    });
  });

  it("falls back to default price when currency option is unavailable", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          currency: "usd",
          currency_options: {},
          lookup_key: "hobby_monthly",
          unit_amount: 999,
        },
      ],
    });

    const result = await getStripePrices(["hobby_monthly"], "xyz");

    expect(result.get("hobby_monthly")).toEqual({
      amount: 999,
      currency: "usd",
    });
  });

  it("handles multiple lookup keys", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          currency: "usd",
          currency_options: {},
          lookup_key: "hobby_monthly",
          unit_amount: 999,
        },
        {
          currency: "usd",
          currency_options: {},
          lookup_key: "plus_monthly",
          unit_amount: 1999,
        },
      ],
    });

    const result = await getStripePrices(["hobby_monthly", "plus_monthly"], "usd");

    expect(result.size).toBe(2);
    expect(result.get("hobby_monthly")?.amount).toBe(999);
    expect(result.get("plus_monthly")?.amount).toBe(1999);
  });

  it("skips prices without lookup_key", async () => {
    mockList.mockResolvedValue({
      data: [
        {
          currency: "usd",
          currency_options: {},
          lookup_key: null,
          unit_amount: 999,
        },
      ],
    });

    const result = await getStripePrices(["hobby_monthly"], "usd");
    expect(result.size).toBe(0);
  });
});
