import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceChangeNoticeFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { completeLessonContent } from "../generation/lesson-generation-state";
import { listCoursesBehind, loadCourseRelease } from "./course-release";
import {
  type ReleaseComparisonResult,
  advanceCourseRelease,
  loadReleaseComparison,
  saveWhatsNewSkills,
} from "./release-advance";
import { saveWhatsNewChapter } from "./release-offers";

const NOW = new Date("2026-11-06T12:00:00Z");

async function productWithReleases() {
  const brand = await brandFixture();
  const page = await sourceFixture({ extractedText: "Version 2 renames the export menu." });

  const product = await productFixture({
    organizationId: brand.id,
    releasesHash: page.contentHash,
    releasesSourceId: page.id,
  });

  const [first, second] = await Promise.all([
    productReleaseFixture({
      name: "Test Product 1",
      productId: product.id,
      releasedAt: new Date("2025-01-10"),
    }),
    productReleaseFixture({
      name: "Test Product 2",
      productId: product.id,
      releasedAt: new Date("2026-01-10"),
    }),
  ]);

  return { brand, first, page, product, second };
}

async function mainCourse({ pinned = false }: { pinned?: boolean } = {}) {
  const setup = await productWithReleases();

  const course = await courseFixture({
    isPinned: pinned,
    organizationId: setup.brand.id,
    productId: setup.product.id,
    productReleaseId: setup.first.id,
  });

  return { ...setup, course };
}

async function follow(courseId: string, how: "primary" | "graph" = "primary") {
  const user = await userFixture();

  if (how === "primary") {
    return goalFixture({ primaryCourseId: courseId, userId: user.id });
  }

  const goal = await goalFixture({ userId: user.id });

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ name: "Basics" }],
      skills: [{ courseIds: [courseId], lessons: 1, name: "Export", phase: 0, skillId: "s1" }],
    },
  });

  return goal;
}

async function homedLessons(courseId: string, count: number) {
  const chapter = await libraryChapterFixture({ homeCourseId: courseId });

  return Promise.all(
    Array.from({ length: count }, () =>
      libraryLessonFixture({
        contentStatus: "completed",
        homeChapterId: chapter.id,
        specStatus: "completed",
      }),
    ),
  );
}

function comparison(
  page: { contentHash: string; id: string },
  attrs: Partial<ReleaseComparisonResult> = {},
): ReleaseComparisonResult {
  return {
    keptLessonIds: [],
    page: { contentHash: page.contentHash, sourceId: page.id },
    provenance: {
      generatedAt: NOW.toISOString(),
      model: "google/gemini-3.8-flash",
      promptVersion: "v1",
      runId: randomUUID(),
    },
    release: "Test Product 2",
    whatsNew: null,
    ...attrs,
  };
}

describe(listCoursesBehind, () => {
  it("lists a product's main courses behind its current release that a learner follows", async () => {
    const [byPrimary, byGraph, unfollowed, pinned, current] = await Promise.all([
      mainCourse(),
      mainCourse(),
      mainCourse(),
      mainCourse({ pinned: true }),
      mainCourse(),
    ]);

    await prisma.course.update({
      data: { productReleaseId: current.second.id },
      where: { id: current.course.id },
    });

    await Promise.all([
      follow(byPrimary.course.id),
      follow(byGraph.course.id, "graph"),
      follow(pinned.course.id),
      follow(current.course.id),
    ]);

    const listed = await Promise.all(
      [byPrimary, byGraph, unfollowed, pinned, current].map(({ product }) =>
        listCoursesBehind({ productId: product.id }),
      ),
    );

    expect(listed).toStrictEqual([[byPrimary.course.id], [byGraph.course.id], [], [], []]);
  });
});

describe(loadCourseRelease, () => {
  it("waits while a lesson its last move flagged is still being rewritten, not on a rewrite that failed days ago", async () => {
    const { course, page, second } = await mainCourse();
    await follow(course.id);

    await expect(loadCourseRelease({ courseId: course.id })).resolves.toStrictEqual({
      fromReleaseId: course.productReleaseId,
      pageSourceIds: [page.id],
      status: "behind",
      toReleaseId: second.id,
    });

    const [lesson] = await homedLessons(course.id, 1);
    const notice = await sourceChangeNoticeFixture({ sourceId: page.id });
    await prisma.contentReviewFlag.create({ data: { lessonId: lesson?.id, noticeId: notice.id } });

    await expect(loadCourseRelease({ courseId: course.id })).resolves.toStrictEqual({
      status: "rewriting",
    });

    const days = 3;

    await expect(
      loadCourseRelease({ courseId: course.id, now: new Date(Date.now() + days * 86_400_000) }),
    ).resolves.toMatchObject({ status: "behind" });
  });

  it("moves one release at a time, never to an announced or undated release and never back", async () => {
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id });

    const [first, second, current, announced, undated] = await Promise.all(
      ["2024-05-01", "2025-05-01", "2026-05-01", "2099-05-01", null].map((date) =>
        productReleaseFixture({ productId: product.id, releasedAt: date ? new Date(date) : null }),
      ),
    );

    const teaching = [null, first, second, current, announced, undated];

    const states = await Promise.all(
      teaching.map(async (release) => {
        const course = await courseFixture({
          organizationId: brand.id,
          productId: product.id,
          productReleaseId: release?.id ?? null,
        });

        await follow(course.id);
        const state = await loadCourseRelease({ courseId: course.id });
        return state.status === "behind" ? state.toReleaseId : state.status;
      }),
    );

    expect(states).toStrictEqual([
      current?.id,
      second?.id,
      current?.id,
      "current",
      "current",
      current?.id,
    ]);
  });

  it("leaves pinned and unfollowed courses alone", async () => {
    const [pinned, unfollowed] = await Promise.all([mainCourse({ pinned: true }), mainCourse()]);
    await follow(pinned.course.id);

    await expect(loadCourseRelease({ courseId: pinned.course.id })).resolves.toStrictEqual({
      status: "notMain",
    });

    await expect(loadCourseRelease({ courseId: unfollowed.course.id })).resolves.toStrictEqual({
      status: "unfollowed",
    });
  });
});

describe(advanceCourseRelease, () => {
  it("moves the course and flags only the lessons the release changed, for a new plan", async () => {
    const { course, first, page, second } = await mainCourse();
    const [changed, kept] = await homedLessons(course.id, 2);
    const state = { courseId: course.id, fromReleaseId: first.id, toReleaseId: second.id };

    const advance = await advanceCourseRelease({
      ...state,
      comparison: comparison(page, { keptLessonIds: [kept?.id ?? ""] }),
    });

    const flags = await prisma.contentReviewFlag.findMany({ where: { id: { in: advance ?? [] } } });

    expect(flags.map((flag) => flag.lessonId)).toStrictEqual([changed?.id]);

    const lessons = await prisma.lesson.findMany({
      select: { id: true, specStatus: true },
      where: { id: { in: [changed?.id ?? "", kept?.id ?? ""] } },
    });

    expect(
      Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson.specStatus])),
    ).toStrictEqual({ [changed?.id ?? ""]: "pending", [kept?.id ?? ""]: "completed" });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ productReleaseId: second.id });
  });

  it("drops the old release's plans for lessons not written yet, also one being written", async () => {
    const { course, first, page, second } = await mainCourse();
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });
    const writerRunId = randomUUID();

    const [failed, writing] = await Promise.all([
      libraryLessonFixture({
        contentStatus: "failed",
        homeChapterId: chapter.id,
        specStatus: "completed",
      }),
      libraryLessonFixture({
        contentRunId: writerRunId,
        contentStatus: "running",
        homeChapterId: chapter.id,
        specStatus: "completed",
      }),
    ]);

    await advanceCourseRelease({
      comparison: comparison(page),
      courseId: course.id,
      fromReleaseId: first.id,
      toReleaseId: second.id,
    });

    await expect(
      completeLessonContent({ lessonId: writing.id, workflowRunId: writerRunId }),
    ).resolves.toBe(false);

    const replans = await Promise.all(
      [failed, writing].map((lesson) =>
        claimLibraryGeneration({
          id: lesson.id,
          target: "lessonSpec",
          workflowRunId: randomUUID(),
        }),
      ),
    );

    expect(replans).toStrictEqual(["claimed", "claimed"]);
  });

  it("flags a lesson written while the comparison ran, since nothing compared it", async () => {
    const { course, first, page, second } = await mainCourse();
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });
    const writerRunId = randomUUID();
    const state = { courseId: course.id, fromReleaseId: first.id, toReleaseId: second.id };

    const writing = await libraryLessonFixture({
      contentRunId: writerRunId,
      contentStatus: "running",
      homeChapterId: chapter.id,
      specStatus: "completed",
    });

    const compared = await loadReleaseComparison(state);

    await expect(
      completeLessonContent({ lessonId: writing.id, workflowRunId: writerRunId }),
    ).resolves.toBe(true);

    const advance = await advanceCourseRelease({
      ...state,
      comparison: comparison(page, { keptLessonIds: compared?.lessons.map(({ id }) => id) }),
    });

    const flags = await prisma.contentReviewFlag.findMany({ where: { id: { in: advance ?? [] } } });

    expect(flags.map((flag) => flag.lessonId)).toStrictEqual([writing.id]);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: writing.id } }),
    ).resolves.toMatchObject({ specStatus: "pending" });
  });

  it("keeps the plan of a chapter challenge, the new release's What's new one included", async () => {
    const { course, first, page, second } = await mainCourse();
    const provenance = comparison(page).provenance;

    const whatsNew = {
      level: "beginner" as const,
      offer: "Learn the new export panel.",
      skills: [{ description: "Export from the new panel.", name: "Export a file" }],
      title: "What's new in Test Product 2",
    };

    const skills = await saveWhatsNewSkills({
      courseId: course.id,
      provenance,
      releaseId: second.id,
      whatsNew,
    });

    const saved = await saveWhatsNewChapter({
      chapter: {
        description: "The new export panel.",
        lessons: [
          {
            canDo: "Export a file from the new panel",
            description: "Export from the new panel.",
            estimatedMinutes: 3,
            skills: ["Export a file"],
            title: "The export panel",
          },
        ],
        objectives: ["Export a file"],
        skillKeys: skills.map((skill) => skill.key),
        title: whatsNew.title,
        tools: [],
      },
      courseId: course.id,
      level: "beginner",
      provenance,
      releaseId: second.id,
      skills,
      workflowRunId: randomUUID(),
    });

    await advanceCourseRelease({
      comparison: comparison(page),
      courseId: course.id,
      fromReleaseId: first.id,
      toReleaseId: second.id,
    });

    const claims = await Promise.all(
      saved.lessonIds.map((id) =>
        claimLibraryGeneration({ id, target: "lessonSpec", workflowRunId: randomUUID() }),
      ),
    );

    expect(claims).toStrictEqual(["claimed", "completed"]);
  });

  it("returns the committed move again on a retry, and nothing for a course that moved", async () => {
    const { course, first, page, second } = await mainCourse();
    const [changed] = await homedLessons(course.id, 1);
    const state = { courseId: course.id, fromReleaseId: first.id, toReleaseId: second.id };

    const compared = comparison(page);

    const advanced = await advanceCourseRelease({ ...state, comparison: compared });
    const retried = await advanceCourseRelease({ ...state, comparison: compared });

    expect(retried).toStrictEqual(advanced);
    expect(advanced).toHaveLength(1);

    await expect(
      advanceCourseRelease({ ...state, comparison: comparison(page) }),
    ).resolves.toBeNull();

    await expect(
      prisma.contentReviewFlag.count({ where: { lessonId: changed?.id } }),
    ).resolves.toBe(1);
  });
});

describe(saveWhatsNewSkills, () => {
  it("saves each new skill once per release and language, however often the update runs", async () => {
    const { course, second } = await mainCourse();

    const input = {
      courseId: course.id,
      provenance: comparison({ contentHash: "h", id: "s" }).provenance,
      releaseId: second.id,
      whatsNew: {
        level: "beginner" as const,
        offer: "Learn the new export panel.",
        skills: [{ description: "Export from the new panel.", name: "Export a file" }],
        title: "What's new in Test Product 2",
      },
    };

    const [saved, again] = await Promise.all([
      saveWhatsNewSkills(input),
      saveWhatsNewSkills(input),
    ]);

    expect(again).toStrictEqual(saved);
    expect(saved.map((skill) => skill.name)).toStrictEqual(["Export a file"]);
  });
});

describe(loadReleaseComparison, () => {
  it("reads an older release's notes from a changelog whose newer releases fill its top", async () => {
    const { course, first, page, product, second } = await mainCourse();
    const newer = `Test Product 20 adds sync.\n${"Fixes and improvements.\n".repeat(4000)}`;

    await Promise.all([
      prisma.source.update({
        data: { extractedText: `${newer}${second.name} moves export to a panel.` },
        where: { id: page.id },
      }),
      productReleaseFixture({ name: "Test Product 20", productId: product.id }),
    ]);

    const input = await loadReleaseComparison({
      courseId: course.id,
      fromReleaseId: first.id,
      toReleaseId: second.id,
    });

    expect(input?.page.text).toContain(`${second.name} moves export to a panel.`);
  });
});
