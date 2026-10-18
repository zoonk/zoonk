import { randomUUID } from "node:crypto";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readLearnerRevision, waitForBlockedStatement } from "../../_test-utils/learner-revision";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { mockDecision, mockSearchTerms, uniqueWord } from "../identity/_test-utils/identity-mocks";
import { temperatureSpec } from "../quality/_test-utils/written-lessons";
import { loadLessonSpecInputs } from "./lesson-spec-inputs";
import { saveLessonSpecs } from "./save-lesson-specs";

const provenance = {
  generatedAt: new Date(),
  model: "openai/gpt-6-sol",
  promptVersion: "v1",
  runId: "run",
};

const scope = { generalGoal: null, language: "en", ownerId: null, targetLanguage: null };

function splitPart(title: string): LessonSpec {
  const word = uniqueWord();
  const spec = temperatureSpec();

  return {
    ...spec,
    skills: spec.skills.map((skill) => ({ ...skill, name: `${skill.name} ${word}` })),
    title: `${title} ${word}`,
  };
}

async function chapterWithLessons() {
  const chapter = await libraryChapterFixture();

  const [first, planned, last] = await Promise.all([
    libraryLessonFixture({
      homeChapterId: chapter.id,
      specStatus: "pending",
      title: "Temperatures",
    }),
    libraryLessonFixture({ homeChapterId: chapter.id }),
    libraryLessonFixture({ homeChapterId: chapter.id }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: first.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: planned.id, position: 1 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: last.id, position: 2 }),
  ]);

  return { chapter, first, last, planned };
}

describe(saveLessonSpecs, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  it("stores the spec for the run that holds the claim and places split parts right after the lesson", async () => {
    const { chapter, first, last, planned } = await chapterWithLessons();
    const workflowRunId = randomUUID();

    await claimLibraryGeneration({ id: first.id, target: "lessonSpec", workflowRunId });

    const inputs = await loadLessonSpecInputs(first.id);

    expect(inputs?.prompt).toMatchObject({
      chapterLessons: [
        expect.objectContaining({ order: "after", title: planned.title }),
        expect.objectContaining({ order: "after", title: last.title }),
      ],
      lessonTitle: "Temperatures",
    });

    const saved = await saveLessonSpecs({
      homeChapterId: chapter.id,
      lessonId: first.id,
      provenance,
      scope,
      specs: [temperatureSpec(), splitPart("Temperatures, part two")],
      workflowRunId,
    });

    expect(saved.status).toBe("saved");
    const [, splitId] = saved.status === "saved" ? saved.lessonIds : [];

    const order = await prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: chapter.id },
    });

    expect(order.map((entry) => entry.lessonId)).toStrictEqual([
      first.id,
      splitId,
      planned.id,
      last.id,
    ]);

    const [stored, split] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: first.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: splitId ?? "" } }),
    ]);

    expect(stored).toMatchObject({ canDo: temperatureSpec().canDo, specStatus: "completed" });

    expect(split).toMatchObject({
      homeChapterId: chapter.id,
      specRunId: workflowRunId,
      specStatus: "completed",
    });
  });

  it("resolves several split parts together, with one search-terms call for their skills and one for the lessons", async () => {
    const { chapter, first, planned } = await chapterWithLessons();
    const workflowRunId = randomUUID();
    const parts = [splitPart("Temperatures, part two"), splitPart("Temperatures, part three")];

    await claimLibraryGeneration({ id: first.id, target: "lessonSpec", workflowRunId });

    const saved = await saveLessonSpecs({
      homeChapterId: chapter.id,
      lessonId: first.id,
      provenance,
      scope,
      specs: [temperatureSpec(), ...parts],
      workflowRunId,
    });

    const splitIds = saved.status === "saved" ? saved.lessonIds.slice(1) : [];

    const calls = vi
      .mocked(generateSearchTerms)
      .mock.calls.map(([input]) => input.subjects.map((subject) => subject.item.title));

    const [splits, order] = await Promise.all([
      prisma.lesson.findMany({
        omit: { spec: true, summary: true },
        where: { id: { in: splitIds } },
      }),
      prisma.chapterLesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: chapter.id },
      }),
    ]);

    expect(calls).toHaveLength(2);

    expect(calls).toStrictEqual(
      expect.arrayContaining([
        parts.map((part) => part.title),
        parts.flatMap((part) => part.skills.map((skill) => skill.name)),
      ]),
    );

    expect(splitIds.map((id) => splits.find((lesson) => lesson.id === id)?.title)).toStrictEqual(
      parts.map((part) => part.title),
    );

    expect(order.map((entry) => entry.lessonId).slice(0, 4)).toStrictEqual([
      first.id,
      ...splitIds,
      planned.id,
    ]);
  });

  it("writes nothing for a run that doesn't hold the claim", async () => {
    const { chapter, first } = await chapterWithLessons();

    await expect(
      saveLessonSpecs({
        homeChapterId: chapter.id,
        lessonId: first.id,
        provenance,
        scope,
        specs: [temperatureSpec()],
        workflowRunId: randomUUID(),
      }),
    ).resolves.toStrictEqual({ status: "notClaimed" });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: first.id } }),
    ).resolves.toMatchObject({ spec: null, specStatus: "pending" });
  });

  it("marks nothing when the run loses its claim while it waits for a plan", async () => {
    const { chapter, first } = await chapterWithLessons();
    const workflowRunId = randomUUID();
    await claimLibraryGeneration({ id: first.id, target: "lessonSpec", workflowRunId });
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: first.id, planId: plan.id });
    const revision = await readLearnerRevision(user.id);
    const held = Promise.withResolvers<number>();
    const released = Promise.withResolvers<null>();

    // Another writer of the plan holds it while the spec waits to mark it.
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await released.promise;
    });

    holder.catch((error: unknown) => held.reject(error));
    const holderPid = await held.promise;

    const saving = saveLessonSpecs({
      homeChapterId: chapter.id,
      lessonId: first.id,
      provenance,
      scope,
      specs: [temperatureSpec()],
      workflowRunId,
    });

    try {
      await waitForBlockedStatement(holderPid, /FOR UPDATE OF plan/u);
      await prisma.lesson.update({ data: { specStatus: "failed" }, where: { id: first.id } });
    } finally {
      released.resolve(null);
      await holder;
    }

    await expect(saving).resolves.toStrictEqual({ status: "notClaimed" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });

    await expect(readLearnerRevision(user.id)).resolves.toBe(revision);
  });
});
