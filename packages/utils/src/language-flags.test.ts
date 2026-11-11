import { describe, expect, it } from "vitest";
import { getLanguageFlagCode } from "./language-flags";

describe(getLanguageFlagCode, () => {
  it("shows the variety courses teach: US English, Brazilian Portuguese, Mexican Spanish", () => {
    expect(getLanguageFlagCode("en")).toBe("us");
    expect(getLanguageFlagCode("pt")).toBe("br");
    expect(getLanguageFlagCode("es")).toBe("mx");
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

  it("shows Taiwan's flag for the Chinese taught there", () => {
    expect(getLanguageFlagCode("zh-TW")).toBe("tw");
  });

  it("shows Hong Kong's flag for Cantonese", () => {
    expect(getLanguageFlagCode("yue")).toBe("hk");
  });

  it("has no flag for a language it doesn't know", () => {
    expect(getLanguageFlagCode("eo")).toBeNull();
    expect(getLanguageFlagCode("")).toBeNull();
  });
});
