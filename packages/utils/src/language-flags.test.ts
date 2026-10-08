import { describe, expect, it } from "vitest";
import { getLanguageFlagCode, getLanguageFlagLabel } from "./language-flags";

describe(getLanguageFlagCode, () => {
  it("shows the variety courses teach: US English, Brazilian Portuguese, Spain Spanish", () => {
    expect(getLanguageFlagCode("en")).toBe("us");
    expect(getLanguageFlagCode("pt")).toBe("br");
    expect(getLanguageFlagCode("es")).toBe("es");
  });

  it("reads the language of a tag with a region, in any case", () => {
    expect(getLanguageFlagCode("en-GB")).toBe("us");
    expect(getLanguageFlagCode("PT_br")).toBe("br");
    expect(getLanguageFlagCode("ja")).toBe("jp");
  });

  it("uses a region's flag for a regional language", () => {
    expect(getLanguageFlagCode("ca")).toBe("es-ct");
    expect(getLanguageFlagCode("ar")).toBe("arab");
  });

  it("has no flag for a language it doesn't know", () => {
    expect(getLanguageFlagCode("eo")).toBeNull();
    expect(getLanguageFlagCode("")).toBeNull();
  });
});

describe(getLanguageFlagLabel, () => {
  it("names the variety the flag marks, in the viewer's language", () => {
    expect(getLanguageFlagLabel({ language: "en", userLanguage: "en" })).toBe("American English");
    expect(getLanguageFlagLabel({ language: "es", userLanguage: "en" })).toBe("European Spanish");

    expect(getLanguageFlagLabel({ language: "pt", userLanguage: "es" })).toBe(
      "Portugués de Brasil",
    );
  });

  it("names only the language when the flag isn't a country's", () => {
    expect(getLanguageFlagLabel({ language: "ca", userLanguage: "en" })).toBe("Catalan");
    expect(getLanguageFlagLabel({ language: "ar", userLanguage: "pt" })).toBe("Árabe");
  });

  it("has no label without a flag", () => {
    expect(getLanguageFlagLabel({ language: "eo", userLanguage: "en" })).toBeNull();
  });
});
