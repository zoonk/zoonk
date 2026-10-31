import { describe, expect, it } from "vitest";
import { getLocaleFromRequest, getRequestCountry } from "./locale-request";

function countryFromLanguage(acceptLanguage: string | null): string {
  return getRequestCountry(
    new Headers(acceptLanguage === null ? {} : { "accept-language": acceptLanguage }),
  );
}

describe(getRequestCountry, () => {
  it("takes Vercel's IP country before the browser's language", () => {
    expect(
      getRequestCountry(new Headers({ "accept-language": "pt-BR", "x-vercel-ip-country": "DE" })),
    ).toBe("DE");
  });

  it("extracts country from first tag with region", () => {
    expect(countryFromLanguage("pt-BR,pt;q=0.9")).toBe("BR");
  });

  it("skips tags without region and returns first match", () => {
    expect(countryFromLanguage("pt;q=0.9,en-US;q=0.8")).toBe("US");
  });

  it("handles single tag with region", () => {
    expect(countryFromLanguage("en-GB")).toBe("GB");
  });

  it("returns US for null", () => {
    expect(countryFromLanguage(null)).toBe("US");
  });

  it("returns US for empty string", () => {
    expect(countryFromLanguage("")).toBe("US");
  });

  it("returns US when no tags have region subtags", () => {
    expect(countryFromLanguage("en,fr,de")).toBe("US");
  });

  it("handles whitespace in tags", () => {
    expect(countryFromLanguage("pt-BR , en-US;q=0.8")).toBe("BR");
  });

  it("handles lowercase region subtags", () => {
    expect(countryFromLanguage("pt-br")).toBe("BR");
  });

  it("returns first region when multiple are present", () => {
    expect(countryFromLanguage("fr-FR,en-US")).toBe("FR");
  });

  it("extracts region from tags with script subtags", () => {
    expect(countryFromLanguage("zh-Hant-TW")).toBe("TW");
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
