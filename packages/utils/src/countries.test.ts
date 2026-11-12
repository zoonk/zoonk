import { describe, expect, it } from "vitest";
import {
  getContentCurrency,
  getCountryChoices,
  getLanguageCountry,
  isCountryCode,
} from "./countries";
import { SUPPORTED_LOCALES } from "./locale";

const ALL_CHOICES = getCountryChoices({ userLanguage: "en" });

describe(isCountryCode, () => {
  it.each(["BR", "PT", "DE", "US", "XK", "AQ"])("accepts %s", (code) => {
    expect(isCountryCode(code)).toBe(true);
  });

  it.each(["ZZ", "EU", "UN", "UK", "QO", "br", "BRA", "", "constructor"])("rejects %s", (code) => {
    expect(isCountryCode(code)).toBe(false);
  });
});

describe(getLanguageCountry, () => {
  it("gives each app language the country its content is written for", () => {
    const countries = SUPPORTED_LOCALES.map((locale) => [locale, getLanguageCountry(locale)]);

    expect(Object.fromEntries(countries)).toStrictEqual({
      de: "DE",
      en: "US",
      es: "MX",
      fr: "FR",
      it: "IT",
      ja: "JP",
      ko: "KR",
      pl: "PL",
      pt: "BR",
      tr: "TR",
    });
  });

  it("reads a regional tag as its language, never as a country", () => {
    expect(getLanguageCountry("pt-PT")).toBe("BR");
    expect(getLanguageCountry("es-AR")).toBe("MX");
  });

  it("has no country for a language the app doesn't write in", () => {
    expect(getLanguageCountry("ar")).toBeNull();
    expect(getLanguageCountry("not a tag")).toBeNull();
  });
});

describe(getContentCurrency, () => {
  it.each([
    ["PT", "EUR"],
    ["BR", "BRL"],
    ["AR", "ARS"],
    ["GB", "GBP"],
    ["IN", "INR"],
    ["NG", "NGN"],
    ["MZ", "MZN"],
    ["AO", "AOA"],
  ])("writes prices in %s as %s", (country, currency) => {
    expect(getContentCurrency(country)).toBe(currency);
  });

  it("has no currency for a code that isn't a country or a country without one", () => {
    expect(getContentCurrency("ZZ")).toBeNull();
    expect(getContentCurrency("AQ")).toBeNull();
  });

  it("only names currencies Intl can format", () => {
    const known = new Set(Intl.supportedValuesOf("currency"));
    const currencies = ALL_CHOICES.map(({ code }) => getContentCurrency(code)).filter(Boolean);

    expect(currencies.filter((currency) => !known.has(currency ?? ""))).toStrictEqual([]);
  });
});

describe(getCountryChoices, () => {
  it("lists every country with a name Intl knows", () => {
    expect(ALL_CHOICES).toHaveLength(250);
    expect(ALL_CHOICES.filter(({ code, name }) => code === name)).toStrictEqual([]);
  });

  it("names countries in the learner's language, sorted by that language's order", () => {
    const choices = getCountryChoices({ userLanguage: "pt" });
    const names = choices.map(({ name }) => name);

    expect(choices).toContainEqual({ code: "DE", name: "Alemanha" });
    expect(names).toStrictEqual(names.toSorted(new Intl.Collator("pt").compare));
  });

  it("puts the given countries first, in their order, once", () => {
    const choices = getCountryChoices({ first: ["PT", "BR", "ZZ", "PT"], userLanguage: "pt" });

    expect(choices.slice(0, 2)).toStrictEqual([
      { code: "PT", name: "Portugal" },
      { code: "BR", name: "Brasil" },
    ]);

    expect(choices).toHaveLength(250);
    expect(choices.filter(({ code }) => code === "PT")).toHaveLength(1);
  });
});
