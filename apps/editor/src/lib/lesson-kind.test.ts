import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { describe, expect, test } from "vitest";
import { getLessonKind } from "./lesson-kind";

describe(getLessonKind, () => {
  test("returns custom when orgSlug is undefined", () => {
    expect(getLessonKind({ courseCategories: [] })).toBe("custom");
  });

  test("returns custom when orgSlug is not AI org", () => {
    expect(getLessonKind({ courseCategories: [], orgSlug: "some-org" })).toBe("custom");
  });

  test("returns language when AI org with languages category", () => {
    expect(getLessonKind({ courseCategories: ["languages"], orgSlug: AI_ORG_SLUG })).toBe(
      "language",
    );
  });

  test("returns core when AI org without languages category", () => {
    expect(getLessonKind({ courseCategories: ["science"], orgSlug: AI_ORG_SLUG })).toBe("core");
  });
});
