import { randomUUID } from "node:crypto";
import { generateCourseOutline } from "@zoonk/ai/tasks/curriculum/course-outline";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import {
  type ReleaseComparison,
  compareReleaseLessons,
} from "@zoonk/ai/tasks/products/compare-release-lessons";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { getStartMock } from "../_test-utils/start-mock";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import { courseReleaseWorkflow } from "./course-release-workflow";

const UNCHANGED: ReleaseComparison = { changed: [], whatsNew: null };

const WHATS_NEW = {
  level: "beginner" as const,
  offer: "Learn the new export panel in version 2.",
  skills: [{ description: "Export a file from the new panel.", name: "Export from the panel" }],
  title: "What's new in Test Product 2",
};

async function productCourse({ pinned = false }: { pinned?: boolean } = {}) {
  const brand = await brandFixture();
  const page = await sourceFixture({ extractedText: "Version 2 moves export to a panel." });

  const product = await productFixture({
    name: "Test Product",
    organizationId: brand.id,
    releasesHash: page.contentHash,
    releasesSourceId: page.id,
  });

  const releases = await Promise.all(
    ["2024-01-10", "2025-01-10", "2026-01-10"].map((date, index) =>
      productReleaseFixture({
        name: `Test Product ${index + 1}`,
        productId: product.id,
        releasedAt: new Date(date),
      }),
    ),
  );

  const course = await courseFixture({
    isPinned: pinned,
    organizationId: brand.id,
    productId: product.id,
    productReleaseId: releases[0]?.id ?? null,
  });

  return { course, releases };
}

async function follow(courseId: string) {
  const user = await userFixture();
  return goalFixture({ primaryCourseId: courseId, userId: user.id });
}

async function homedLessons(courseId: string, count: number) {
  const chapter = await libraryChapterFixture({ homeCourseId: courseId });

  return Promise.all(
    Array.from({ length: count }, () =>
      libraryLessonFixture({ contentStatus: "completed", homeChapterId: chapter.id }),
    ),
  );
}

function exportOutline() {
  return taskResult({
    chapters: [
      {
        description: "The new export panel.",
        lessons: [
          {
            canDo: "Export from the panel",
            description: "Where export lives now.",
            estimatedMinutes: 3,
            skills: ["Export from the panel"],
            title: `Export panel ${randomUUID()}`,
          },
        ],
        objectives: ["Export from the panel"],
        skillKeys: [],
        title: "Another title",
        tools: [],
      },
    ],
  });
}

function compareWith(...comparisons: ReleaseComparison[]) {
  comparisons.reduce(
    (mock, comparison) => mock.mockResolvedValueOnce(taskResult(comparison) as never),
    vi.mocked(compareReleaseLessons),
  );
}

describe(courseReleaseWorkflow, () => {
  beforeEach(() => {
    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({ subjects: subjects.map(() => ({ terms: [`zq${randomUUID()}`] })) }) as never,
    );
  });

  it("applies each release in turn until the course teaches the current one", async () => {
    const { course, releases } = await productCourse();
    await follow(course.id);
    compareWith(UNCHANGED, UNCHANGED);

    await expect(courseReleaseWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      releasesApplied: 2,
      status: "current",
    });

    expect(vi.mocked(compareReleaseLessons).mock.calls.map(([params]) => params.to)).toStrictEqual([
      "Test Product 2",
      "Test Product 3",
    ]);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ productReleaseId: releases[2]?.id });
  });

  it("rewrites the changed lessons ten per run, adds the chapter, and waits for the rewrites before the next release", async () => {
    const { course, releases } = await productCourse();
    await follow(course.id);
    const lessons = await homedLessons(course.id, 12);

    compareWith({
      changed: lessons.slice(0, 11).map((_, index) => ({ change: "Moved.", lesson: index + 1 })),
      whatsNew: WHATS_NEW,
    });

    vi.mocked(generateCourseOutline).mockImplementation(async () => exportOutline() as never);

    await expect(courseReleaseWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      releasesApplied: 1,
      status: "rewriting",
    });

    const rewrites = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === flaggedContentWorkflow)
      .map(([, args]) => (args as [{ flagIds: string[] }])[0].flagIds.length);

    expect(rewrites).toStrictEqual([10, 1]);

    const chapters = await prisma.courseChapter.findMany({
      include: { chapter: true },
      where: { courseId: course.id },
    });

    expect(chapters.map((placement) => placement.chapter.title)).toStrictEqual([WHATS_NEW.title]);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ productReleaseId: releases[1]?.id });
  });

  it("leaves the course behind, to try again, when its What's new chapter can't be written", async () => {
    const { course, releases } = await productCourse();
    await follow(course.id);
    compareWith({ changed: [], whatsNew: WHATS_NEW });
    vi.mocked(generateCourseOutline).mockRejectedValue(new Error("Model unavailable"));

    await expect(courseReleaseWorkflow({ courseId: course.id })).rejects.toThrow(
      "Model unavailable",
    );

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ productReleaseId: releases[0]?.id });
  });

  it("offers the chapter an earlier run saved, instead of writing a second one, when that run failed before the move", async () => {
    const { course, releases } = await productCourse();
    await follow(course.id);
    vi.mocked(generateCourseOutline).mockImplementation(async () => exportOutline() as never);
    compareWith({ changed: [], whatsNew: WHATS_NEW }, UNCHANGED);
    await courseReleaseWorkflow({ courseId: course.id });

    await prisma.course.update({
      data: { productReleaseId: releases[0]?.id ?? null },
      where: { id: course.id },
    });

    compareWith(
      {
        changed: [],
        whatsNew: {
          ...WHATS_NEW,
          level: "advanced",
          skills: [...WHATS_NEW.skills, { description: "Share a link.", name: "Share a link" }],
        },
      },
      UNCHANGED,
    );

    await courseReleaseWorkflow({ courseId: course.id });

    expect(generateCourseOutline).toHaveBeenCalledOnce();

    await expect(prisma.courseChapter.count({ where: { courseId: course.id } })).resolves.toBe(1);
  });

  it("leaves a pinned or unfollowed course alone, without comparing", async () => {
    const [pinned, unfollowed] = await Promise.all([
      productCourse({ pinned: true }),
      productCourse(),
    ]);

    await follow(pinned.course.id);

    await expect(courseReleaseWorkflow({ courseId: pinned.course.id })).resolves.toStrictEqual({
      releasesApplied: 0,
      status: "notMain",
    });

    await expect(courseReleaseWorkflow({ courseId: unfollowed.course.id })).resolves.toStrictEqual({
      releasesApplied: 0,
      status: "unfollowed",
    });

    expect(compareReleaseLessons).not.toHaveBeenCalled();
  });
});
