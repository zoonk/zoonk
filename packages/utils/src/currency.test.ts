import { describe, expect, it } from "vitest";
import { BILLING_CURRENCIES, countryToCurrency, formatPrice } from "./currency";

describe("billing currencies", () => {
  it("has every currency a country is billed in once, and the default for every other country", () => {
    const countries = ["US", "BR", "GB", "JP", "DE", "IN", "IS", "UY", "ZZ"];

    expect(new Set(BILLING_CURRENCIES).size).toBe(BILLING_CURRENCIES.length);
    expect(
      countries.every((country) => BILLING_CURRENCIES.includes(countryToCurrency(country))),
    ).toBe(true);
  });
});

describe(countryToCurrency, () => {
  it("returns correct currency for known countries", () => {
    expect(countryToCurrency("US")).toBe("usd");
    expect(countryToCurrency("BR")).toBe("brl");
    expect(countryToCurrency("GB")).toBe("gbp");
    expect(countryToCurrency("JP")).toBe("jpy");
    expect(countryToCurrency("DE")).toBe("eur");
    expect(countryToCurrency("IN")).toBe("inr");
    expect(countryToCurrency("IS")).toBe("isk");
    expect(countryToCurrency("UY")).toBe("uyu");
    expect(countryToCurrency("BG")).toBe("eur");
    expect(countryToCurrency("ME")).toBe("eur");
    expect(countryToCurrency("SM")).toBe("eur");
    expect(countryToCurrency("VA")).toBe("eur");
    expect(countryToCurrency("XK")).toBe("eur");
  });

  it("handles lowercase country codes", () => {
    expect(countryToCurrency("us")).toBe("usd");
    expect(countryToCurrency("br")).toBe("brl");
  });

  it("falls back to usd for unsupported and unknown countries", () => {
    expect(countryToCurrency("AR")).toBe("usd");
    expect(countryToCurrency("XX")).toBe("usd");
    expect(countryToCurrency("ZZ")).toBe("usd");
    expect(countryToCurrency("")).toBe("usd");
  });
});

describe(formatPrice, () => {
  it("formats USD prices correctly", () => {
    expect(formatPrice(999, "usd")).toBe("$9.99");
    expect(formatPrice(1000, "usd")).toBe("$10");
    expect(formatPrice(1050, "usd")).toBe("$10.50");
    expect(formatPrice(2499, "usd")).toBe("$24.99");
  });

  it("formats zero-decimal currencies (JPY)", () => {
    expect(formatPrice(1000, "jpy")).toBe("\u00A51,000");
    expect(formatPrice(500, "jpy", "ja-JP")).toBe("\uFFE5500");
  });

  it("formats EUR with locale", () => {
    expect(formatPrice(999, "eur", "de-DE")).toContain("9,99");
  });

  it("formats BRL", () => {
    const result = formatPrice(4990, "brl", "pt-BR");
    expect(result).toContain("49,90");
  });

  it("formats zero-decimal currency KRW", () => {
    expect(formatPrice(10_000, "krw", "ko-KR")).toContain("10,000");
  });
});
