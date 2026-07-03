import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { getMissingChapterImageInputsStep } from "./get-missing-chapter-image-inputs-step";

describe(getMissingChapterImageInputsStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns course chapters without image urls ordered by position", async () => {
    const course = await courseFixture({ organizationId });

    const [secondMissingChapter, firstMissingChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        imageUrl: null,
        organizationId,
        position: 2,
        title: `Second Missing Image ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: course.id,
        imageUrl: null,
        organizationId,
        position: 0,
        title: `First Missing Image ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: course.id,
        imageUrl: "https://example.com/chapter/existing.webp",
        organizationId,
        position: 1,
        title: `Existing Image ${randomUUID()}`,
      }),
    ]);

    const result = await getMissingChapterImageInputsStep(course.id);

    expect(result.map((chapter) => chapter.id)).toStrictEqual([
      firstMissingChapter.id,
      secondMissingChapter.id,
    ]);
  });
});
