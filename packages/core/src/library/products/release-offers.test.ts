import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { brandFixture, productFixture } from "@zoonk/testing/fixtures/products";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { saveWhatsNewSkills } from "./release-advance";
import { findWhatsNewChapter, offerWhatsNew, saveWhatsNewChapter } from "./release-offers";

const NOW = new Date("2020-09-28T12:00:00Z");

const PROVENANCE = {
  generatedAt: NOW.toISOString(),
  model: "google/gemini-3.8-flash",
  promptVersion: "v1",
  runId: "compare-run",
};

async function setup() {
  const brand = await brandFixture();
  const product = await productFixture({ organizationId: brand.id });
  const course = await courseFixture({ organizationId: brand.id, productId: product.id });
  const library = await planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] });
  const chapter = library.chapters[0];

  if (!chapter) {
    throw new Error("Expected a library chapter");
  }

  await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

  const skills = await Promise.all(
    ["Export from the new panel", "Share a live link"].map((name) => skillFixture({ name })),
  );

  const offer = {
    courseId: course.id,
    lessons: 2,
    offer: "Learn the new export panel and live links in version 2.",
    provenance: PROVENANCE,
    releaseId: `release-${crypto.randomUUID()}`,
    skills: skills.map((skill) => ({ ...skill, key: skill.id })),
  };

  return { course, library, offer };
}

async function learner({
  course,
  library,
  started,
}: Awaited<ReturnType<typeof setup>> & { started: boolean }) {
  const user = await userFixture();

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    primaryCourseId: course.id,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  if (started) {
    const first = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { chapterId: { not: null }, kind: "lesson", planId: plan.id },
    });

    await prisma.planItem.update({
      data: { completedAt: NOW, status: "done" },
      where: { id: first.id },
    });
  }

  return { goal, plan, user };
}

function listReleaseChanges(planId: string) {
  return prisma.planChange.findMany({
    where: { payload: { equals: "release", path: ["source"] }, planId },
  });
}

describe(offerWhatsNew, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the new skills once to learners past the course's start, taught by the course", async () => {
    const fixture = await setup();
    const started = await learner({ ...fixture, started: true });
    const fresh = await learner({ ...fixture, started: false });
    await expect(offerWhatsNew({ ...fixture.offer, after: null })).resolves.toBeNull();
    await offerWhatsNew({ ...fixture.offer, after: null });

    const [changes, freshChanges] = await Promise.all([
      listReleaseChanges(started.plan.id),
      listReleaseChanges(fresh.plan.id),
    ]);

    expect(freshChanges).toStrictEqual([]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ reason: fixture.offer.offer, status: "proposed" });

    mockSession(started.user.id);

    await decidePlanChange({
      changeId: changes[0]?.id ?? "",
      goalId: started.goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: started.plan.id } });

    const added = parsePlanGraph(plan.graph).skills.filter((skill) =>
      fixture.offer.skills.some((offered) => offered.id === skill.skillId),
    );

    expect(added.map((skill) => skill.courseIds)).toStrictEqual([
      [fixture.course.id],
      [fixture.course.id],
    ]);
  });
});

describe(findWhatsNewChapter, () => {
  it("reuses only a What's new chapter whose lessons were all saved", async () => {
    const { course } = await setup();
    const releaseId = crypto.randomUUID();

    const [skill, chapter] = await Promise.all([
      skillFixture({ identityKey: `whats-new:${releaseId}:exportfromthepanel` }),
      libraryChapterFixture({ outlineStatus: "failed" }),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 50 }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    ]);

    await expect(findWhatsNewChapter({ courseId: course.id, releaseId })).resolves.toBeNull();

    await prisma.chapter.update({
      data: { outlineStatus: "completed" },
      where: { id: chapter.id },
    });

    await expect(findWhatsNewChapter({ courseId: course.id, releaseId })).resolves.toMatchObject({
      skills: [{ id: skill.id, key: skill.id }],
    });
  });
});

describe(saveWhatsNewChapter, () => {
  it("keeps apart lessons whose titles differ only in symbols", async () => {
    const { course } = await setup();
    const releaseId = crypto.randomUUID();

    const lessons = [
      { skill: "Compile native programs", title: "Use C++" },
      { skill: "Build managed applications", title: "Use C#" },
    ];

    const whatsNew = {
      level: "beginner" as const,
      offer: "Learn the new languages.",
      skills: lessons.map(({ skill }) => ({ description: skill, name: skill })),
      title: "What's new",
    };

    const skills = await saveWhatsNewSkills({
      courseId: course.id,
      provenance: PROVENANCE,
      releaseId,
      whatsNew,
    });

    const saved = await saveWhatsNewChapter({
      chapter: {
        description: "New languages.",
        lessons: lessons.map(({ skill, title }) => ({
          canDo: skill,
          description: skill,
          estimatedMinutes: 3,
          skills: [skill],
          title,
        })),
        objectives: lessons.map(({ skill }) => skill),
        skillKeys: skills.map((skill) => skill.key),
        title: whatsNew.title,
        tools: [],
      },
      courseId: course.id,
      level: "beginner",
      provenance: PROVENANCE,
      releaseId,
      skills,
      workflowRunId: crypto.randomUUID(),
    });

    const titles = await prisma.lesson.findMany({
      select: { title: true },
      where: { id: { in: saved.lessonIds } },
    });

    expect(titles.map(({ title }) => title)).toStrictEqual(
      expect.arrayContaining(["Use C++", "Use C#"]),
    );
  });
});
