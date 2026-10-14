import { describe, expect, it } from "vitest";
import { findPrerenderErrors } from "./prerender-errors.mts";

describe("development prerender failures", () => {
  it.each([
    'Error: Route "/[lang]/today": A `"use cache"` function took too long during prerendering.',
    'Error: Route "/[lang]/today": Unexpected cache miss after cache warming phase during prerendering.',
  ])("recognizes the installed cache failure: %s", (message) => {
    expect(findPrerenderErrors(message)).toHaveLength(1);
  });

  it.each([
    'InvariantError: Route "/[lang]/today" failed to render during instant validation and Next.js was unable to determine a reason.',
    "InvariantError: An unexpected error occurred during validation",
    "InvariantError: Invariant: An unexpected error occurred during validation. This is a bug in Next.js.",
    "Error [InvariantError]: Invariant: An unexpected error occurred during validation. This is a bug in Next.js.",
    'Error [InvariantError]: Invariant: Route "/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]" did not produce a static shell and Next.js was unable to determine a reason. This is a bug in Next.js.',
  ])("rejects an inconclusive installed validator: %s", (message) => {
    expect(findPrerenderErrors(message)).toHaveLength(1);
  });

  it.each([
    'Error: Route "/[lang]/courses": Next.js encountered the unstable value `new Date()` while prerendering.',
    'Error: Route "/[lang]/today" used `Date.now()` before accessing uncached data.',
    'Error: Route "/[lang]/plan" used `Math.random()` before accessing uncached data.',
    'Error: Route "/[lang]/buddy" used `crypto.randomUUID()` outside of "use cache".',
    'Error: Route "/[lang]/pricing/[currency]": Next.js encountered URL data during prerendering or a navigation.',
    'Error: Route "/[lang]/today": Next.js encountered uncached data during prerendering.',
    'Error: Route "/[lang]/plan": Next.js encountered runtime data during prerendering.',
    'Error: Route "/[lang]/exam": Next.js encountered non-prerenderable data in a static route.',
    "Error: Blocking Route /pt/plan",
    "Error: Instant Navigation validation failed for /pt/today",
    'Error: Route "/[lang]/today": A `"use cache"` function is awaiting a promise created outside it.',
    'Error: Route "/[lang]/today": Could not validate `instant` because an error prevented the target segment from rendering.',
  ])("recognizes the actual warning/error class: %s", (message) => {
    expect(findPrerenderErrors(message)).toHaveLength(1);
  });

  it("deduplicates ANSI-colored warnings and escaped RSC copies", () => {
    const message =
      'Error: Route "/[lang]/today": Next.js encountered the unstable value `new Date()` while prerendering.';

    expect(
      findPrerenderErrors(
        `\u001B[31m${message}\u001B[0m\n${message.replaceAll('"', String.raw`\"`)}`,
      ),
    ).toHaveLength(1);
  });

  it("keeps actionable stack context and excludes ordinary timing and guidance", () => {
    const output = [
      "GET /pt/today 200 in 1.2s",
      "The docs explain Instant Navigation and blocking routes.",
      "  - [block] Set `export const instant = false` to allow a blocking route",
      'Error: Route "/[lang]/pricing/[currency]": Next.js encountered URL data during prerendering or a navigation.',
      "    at PricingInCurrency (src/app/[lang]/pricing/[currency]/page.tsx:25:24)",
    ].join("\n");

    const found = findPrerenderErrors(output);
    expect(found).toHaveLength(1);
    expect(found[0]?.context).toContain("PricingInCurrency");
  });
});
