import { describe, expect, it } from "vitest";
import { readCatalogOrigin, withCatalogOrigin } from "./public-hrefs";

describe(readCatalogOrigin, () => {
  it("reads a course's, a chapter's or a lesson's path, with the place on it", () => {
    for (const value of [
      "/b/ai/c/enem-pt",
      "/b/ai/c/enem-pt#try-lesson-1a2b",
      "/b/ai/c/x/ch/y/l/z",
    ]) {
      expect(readCatalogOrigin(value)).toBe(value);
    }
  });

  it("never reads anything that could leave the catalog", () => {
    for (const value of [
      "//evil.com",
      "https://evil.com/b/a/c/b",
      "/pt/b/ai/c/x",
      "/b/ai/c/x?next=/",
      "/b/ai/c/x/ch",
      "/today",
    ]) {
      expect(readCatalogOrigin(value)).toBeNull();
    }

    expect(readCatalogOrigin(["/b/ai/c/x", "/b/ai/c/y"])).toBeNull();
  });
});

describe(withCatalogOrigin, () => {
  it("adds the page to a player link, after any query it has", () => {
    expect(withCatalogOrigin("/pt/learn/l1", "/b/ai/c/x")).toBe(
      "/pt/learn/l1?from=%2Fb%2Fai%2Fc%2Fx",
    );

    expect(withCatalogOrigin("/learn/l1?generation=g", "/b/ai/c/x")).toBe(
      "/learn/l1?generation=g&from=%2Fb%2Fai%2Fc%2Fx",
    );
  });
});
