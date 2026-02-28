import { describe, expect, it, vi } from "vitest";
import { deduplicateImportSlugs, resolveImportSlug } from "./import-slug";

vi.mock("server-only", () => ({}));

describe(resolveImportSlug, () => {
  it("preserves explicit slugs even when a record exists", () => {
    const result = resolveImportSlug({
      existingRecord: { id: 1 },
      hasExplicitSlug: true,
      index: 0,
      slug: "my-slug",
    });

    expect(result).toBe("my-slug");
  });

  it("preserves slug when no collision exists", () => {
    const result = resolveImportSlug({
      existingRecord: null,
      hasExplicitSlug: false,
      index: 0,
      slug: "my-slug",
    });

    expect(result).toBe("my-slug");
  });

  it("appends unique suffix for auto-generated slug with collision", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234_567_890);

    const result = resolveImportSlug({
      existingRecord: { id: 1 },
      hasExplicitSlug: false,
      index: 3,
      slug: "my-slug",
    });

    expect(result).toBe("my-slug-1234567890-3");

    vi.restoreAllMocks();
  });
});

describe(deduplicateImportSlugs, () => {
  it("leaves unique slugs unchanged", () => {
    const items = [
      { index: 0, slug: "alpha" },
      { index: 1, slug: "beta" },
      { index: 2, slug: "gamma" },
    ];

    const result = deduplicateImportSlugs(items);

    expect(result).toEqual([
      { index: 0, slug: "alpha" },
      { index: 1, slug: "beta" },
      { index: 2, slug: "gamma" },
    ]);
  });

  it("appends suffix to duplicate slugs", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234_567_890);

    const items = [
      { index: 0, slug: "same" },
      { index: 1, slug: "same" },
      { index: 2, slug: "same" },
    ];

    const result = deduplicateImportSlugs(items);

    expect(result.map((item) => item.slug)).toEqual([
      "same",
      "same-1234567890-1",
      "same-1234567890-2",
    ]);

    vi.restoreAllMocks();
  });

  it("preserves order and extra properties", () => {
    const items = [
      { extra: "a", index: 0, slug: "one" },
      { extra: "b", index: 1, slug: "two" },
    ];

    const result = deduplicateImportSlugs(items);

    expect(result).toEqual([
      { extra: "a", index: 0, slug: "one" },
      { extra: "b", index: 1, slug: "two" },
    ]);
  });
});
