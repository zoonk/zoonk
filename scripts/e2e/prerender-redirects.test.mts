import { describe, expect, it } from "vitest";
import { hasVerifiedBlogRedirects, isExpectedPrerenderRedirect } from "./prerender-redirects.mts";

const context = {
  baseURL: "http://localhost:34001",
  blogURL: "https://blog.zoonk.com",
  locale: "pt",
  location: "https://blog.zoonk.com",
  path: "/pt/blog",
  persona: "visitor",
  status: 307,
};

describe("intentional Main redirects", () => {
  it("requires current exact receipts for both blog personas before exempting its empty shell", () => {
    const visitor = { ...context };
    const learner = { ...context, persona: "learner" };

    const verify = (results: unknown) =>
      hasVerifiedBlogRedirects({ ...context, result: { results } });

    expect(verify([visitor, learner])).toBe(true);
    expect(verify([visitor])).toBe(false);
    expect(verify([learner])).toBe(false);
    expect(verify([visitor, { ...learner, status: 200 }])).toBe(false);
    expect(verify([visitor, { ...learner, location: "https://other.test" }])).toBe(false);
    expect(verify([{ ...visitor, path: "/pt" }, learner])).toBe(false);
    expect(verify(null)).toBe(false);
  });

  it("accepts the actual blog redirect only at its exact destination", () => {
    expect(isExpectedPrerenderRedirect(context)).toBe(true);

    expect(
      isExpectedPrerenderRedirect({ ...context, location: "https://blog.zoonk.com/other" }),
    ).toBe(false);

    expect(
      isExpectedPrerenderRedirect({ ...context, location: "https://blog.zoonk.com.attacker.test" }),
    ).toBe(false);
  });

  it("accepts the signed-in home redirect to the local Today route", () => {
    expect(
      isExpectedPrerenderRedirect({
        ...context,
        location: "/pt/today",
        path: "/pt",
        persona: "learner",
      }),
    ).toBe(true);

    expect(
      isExpectedPrerenderRedirect({
        ...context,
        location: "https://other.test/pt/today",
        path: "/pt",
        persona: "learner",
      }),
    ).toBe(false);
  });

  it.each([
    { location: undefined },
    { status: 200 },
    { status: 308 },
    { path: "/pt/today" },
    { location: "/pt/today", path: "/pt" },
  ])("keeps unexpected redirect/abort cases fail-closed: %j", (change) => {
    expect(isExpectedPrerenderRedirect({ ...context, ...change })).toBe(false);
  });
});
