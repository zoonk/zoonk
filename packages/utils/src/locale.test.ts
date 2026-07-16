import { describe, expect, it } from "vitest";
import {
  getCountryFromAcceptLanguage,
  getLocaleFromHeaders,
  getLocaleFromRequest,
  getSupportedLocaleFromLanguage,
  isValidLocale,
} from "./locale";

describe(isValidLocale, () => {
  it("accepts every app locale", () => {
    expect(["en", "es", "pt", "fr", "de"].every((locale) => isValidLocale(locale))).toBe(true);
  });

  it("rejects unsupported locale codes", () => {
    expect(isValidLocale("it")).toBe(false);
  });
});

describe(getCountryFromAcceptLanguage, () => {
  it("extracts country from first tag with region", () => {
    expect(getCountryFromAcceptLanguage("pt-BR,pt;q=0.9")).toBe("BR");
  });

  it("skips tags without region and returns first match", () => {
    expect(getCountryFromAcceptLanguage("pt;q=0.9,en-US;q=0.8")).toBe("US");
  });

  it("handles single tag with region", () => {
    expect(getCountryFromAcceptLanguage("en-GB")).toBe("GB");
  });

  it("returns US for null", () => {
    expect(getCountryFromAcceptLanguage(null)).toBe("US");
  });

  it("returns US for empty string", () => {
    expect(getCountryFromAcceptLanguage("")).toBe("US");
  });

  it("returns US when no tags have region subtags", () => {
    expect(getCountryFromAcceptLanguage("en,fr,de")).toBe("US");
  });

  it("handles whitespace in tags", () => {
    expect(getCountryFromAcceptLanguage("pt-BR , en-US;q=0.8")).toBe("BR");
  });

  it("handles lowercase region subtags", () => {
    expect(getCountryFromAcceptLanguage("pt-br")).toBe("BR");
  });

  it("returns first region when multiple are present", () => {
    expect(getCountryFromAcceptLanguage("fr-FR,en-US")).toBe("FR");
  });

  it("extracts region from tags with script subtags", () => {
    expect(getCountryFromAcceptLanguage("zh-Hant-TW")).toBe("TW");
  });
});

describe(getLocaleFromHeaders, () => {
  it("matches French from regional browser preferences", () => {
    expect(getLocaleFromHeaders("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
  });

  it("matches German from regional browser preferences", () => {
    expect(getLocaleFromHeaders("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
  });
});

describe(getSupportedLocaleFromLanguage, () => {
  it("keeps supported base languages", () => {
    expect(getSupportedLocaleFromLanguage("pt")).toBe("pt");
  });

  it("uses the base language from regional language tags", () => {
    expect(getSupportedLocaleFromLanguage("pt-BR")).toBe("pt");
  });

  it("falls back to English for unsupported languages", () => {
    expect(getSupportedLocaleFromLanguage("it")).toBe("en");
  });
});

describe(getLocaleFromRequest, () => {
  it("uses a valid manual locale cookie before browser detection", () => {
    expect(
      getLocaleFromRequest({ acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8", cookieLocale: "de" }),
    ).toBe("de");
  });

  it("ignores invalid manual locale cookies and detects from the browser", () => {
    expect(
      getLocaleFromRequest({
        acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
        cookieLocale: "NEXT_LOCALE",
      }),
    ).toBe("fr");
  });

  it("detects from the browser when there is no manual locale cookie", () => {
    expect(getLocaleFromRequest({ acceptLanguage: "de-DE,de;q=0.9,en;q=0.8" })).toBe("de");
  });
});
