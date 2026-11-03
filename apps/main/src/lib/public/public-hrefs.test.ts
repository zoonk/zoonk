import { describe, expect, it } from "vitest";
import { readLessonOrigin, withOrigin } from "./public-hrefs";

describe(readLessonOrigin, () => {
  it("reads a course's, a chapter's or a lesson's path, with the place on it", () => {
    for (const value of [
      "/b/ai/c/enem-pt",
      "/b/ai/c/enem-pt#try-lesson-1a2b",
      "/b/ai/c/x/ch/y/l/z",
    ]) {
      expect(readLessonOrigin(value)).toStrictEqual({ kind: "catalog", path: value });
    }
  });

  it("reads exactly Today and Completed lessons as app places", () => {
    for (const value of ["/today", "/completed-lessons"]) {
      expect(readLessonOrigin(value)).toStrictEqual({ kind: "app", path: value });
    }
  });

  it("never reads anything that could leave the catalog or the app's places", () => {
    for (const value of [
      "//evil.com",
      "https://evil.com/b/a/c/b",
      "/pt/b/ai/c/x",
      "/b/ai/c/x?next=/",
      "/b/ai/c/x/ch",
      "/plan",
      "/today/",
      "/today?next=//evil.com",
      "/today#x",
      "/completed-lessons?shown=100",
      "/completed-lessons/x",
      "/pt/today",
      "//today",
      "https://zoonk.com/today",
      "today",
    ]) {
      expect(readLessonOrigin(value)).toBeNull();
    }

    expect(readLessonOrigin(["/today", "/completed-lessons"])).toBeNull();
  });
});

describe(withOrigin, () => {
  it("adds the page to a player link, after any query it has", () => {
    expect(withOrigin("/pt/learn/l1", "/b/ai/c/x")).toBe("/pt/learn/l1?from=%2Fb%2Fai%2Fc%2Fx");

    expect(withOrigin("/learn/l1?generation=g", "/b/ai/c/x")).toBe(
      "/learn/l1?generation=g&from=%2Fb%2Fai%2Fc%2Fx",
    );
  });
});
