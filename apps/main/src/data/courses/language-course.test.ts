import { listCompletedLanguageCourses } from "@zoonk/core/courses/language";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { describe, expect, it, vi } from "vitest";
import { getCompletedLanguageCourseHrefs } from "./language-course";

vi.mock("@zoonk/core/courses/language", () => ({ listCompletedLanguageCourses: vi.fn() }));

describe(getCompletedLanguageCourseHrefs, () => {
  it("maps completed language course resources to main routes", async () => {
    const language = `q${crypto.randomUUID().slice(0, 8)}`;
    const slug = `language-course-${crypto.randomUUID().slice(0, 8)}`;

    const course = await courseFixture({ slug });

    vi.mocked(listCompletedLanguageCourses).mockResolvedValue([{ course, targetLanguage: "es" }]);

    await expect(getCompletedLanguageCourseHrefs({ language })).resolves.toStrictEqual({
      es: `/b/${AI_ORG_SLUG}/c/${slug}`,
    });

    expect(listCompletedLanguageCourses).toHaveBeenCalledExactlyOnceWith({ language });
  });
});
