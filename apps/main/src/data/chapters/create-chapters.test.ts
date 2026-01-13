import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { toSlug } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { createChapters } from "./create-chapters";

describe("createChapters", () => {
  let organizationId: number;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  test("creates chapters with correct positions", async () => {
    const course = await courseFixture({ organizationId });

    const chapters = [
      {
        description: "Chapter 1 description",
        title: `Chapter 1 ${randomUUID()}`,
      },
      {
        description: "Chapter 2 description",
        title: `Chapter 2 ${randomUUID()}`,
      },
    ];

    const result = await createChapters({
      chapters,
      courseId: course.id,
      language: "en",
      organizationId,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);

    expect(result.data?.[0]?.position).toBe(0);
    expect(result.data?.[0]?.title).toBe(chapters[0]?.title);
    expect(result.data?.[0]?.slug).toBe(toSlug(chapters[0]?.title ?? ""));

    expect(result.data?.[1]?.position).toBe(1);
    expect(result.data?.[1]?.title).toBe(chapters[1]?.title);
  });

  test("creates chapters with pending status and no run ID", async () => {
    const course = await courseFixture({ organizationId });

    const chapters = [
      {
        description: "Test description",
        title: `Test Chapter ${randomUUID()}`,
      },
    ];

    const result = await createChapters({
      chapters,
      courseId: course.id,
      language: "en",
      organizationId,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.id).toBeTypeOf("number");

    const dbChapter = await prisma.chapter.findUnique({
      where: { id: result.data?.[0]?.id },
    });

    expect(dbChapter?.organizationId).toBe(organizationId);
    expect(dbChapter?.generationRunId).toBeNull();
    expect(dbChapter?.generationStatus).toBe("pending");
    expect(dbChapter?.isPublished).toBe(true);
  });
});
