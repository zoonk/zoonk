import { describe, expect, it } from "vitest";
import { getCountryFromAcceptLanguage } from "./locale";

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
