import { randomUUID } from "node:crypto";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { describe, expect, it } from "vitest";
import { getSecondTakeIdentityKey } from "../second-takes/second-take-identity";
import { lessonNeedsPlan } from "./lesson-needs-plan";

describe(lessonNeedsPlan, () => {
  it("plans a lesson that teaches a subject", async () => {
    const lesson = await libraryLessonFixture();
    await expect(lessonNeedsPlan(lesson.id)).resolves.toBe(true);
  });

  it("leaves a language lesson to its writer", async () => {
    const lesson = await libraryLessonFixture({ language: "pt", targetLanguage: "en" });
    await expect(lessonNeedsPlan(lesson.id)).resolves.toBe(false);
  });

  it("plans a language lesson's second take, which its plan names", async () => {
    const lesson = await libraryLessonFixture({
      identityKey: getSecondTakeIdentityKey({ ownerId: null, skillId: randomUUID() }),
      language: "pt",
      targetLanguage: "en",
    });

    await expect(lessonNeedsPlan(lesson.id)).resolves.toBe(true);
  });
});
