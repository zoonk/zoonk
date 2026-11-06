import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { type Source, prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { writeLessonContent } from "../../_test-utils/write-lesson-content";
import {
  loadStatuteDrillTargets,
  writeStatuteDrills,
} from "../../exams/statutes/statute-drill-targets";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { completeLessonContent } from "../generation/lesson-generation-state";
import {
  publishStagedLessonVersion,
  stageLessonVersion,
} from "../lessons/_utils/save-lesson-content";
import { temperatureSpec, writtenTemperatureLesson } from "../quality/_test-utils/written-lessons";
import { checkPublishedLesson, publishFixedVersion } from "../quality/published-lesson-check";
import { createSourceChangeNotice } from "../sources/content-review-flags";
import { recordSourceChangeNotice } from "../sources/source-change-notices";
import { PAGE_BREAK, PDF_CONTENT_TYPE } from "../sources/source-contract";
import { prepareFlaggedContent } from "./flagged-content";
import { replaceFlaggedDrills } from "./rewrite-flagged-drills";

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  model: "test/model",
  promptVersion: "v1",
  runId: "r1",
};

const FORECAST = "A forecast rise adds to the temperature, even below zero";

function forecastText(reading: string) {
  return ["Agency history and contact details.", `${FORECAST}: ${reading}`].join(PAGE_BREAK);
}

function lawText(days: string) {
  return [
    "LEI Nº 8.112, DE 11 DE DEZEMBRO DE 1990",
    `Art. 13. A posse ocorrerá no prazo de ${days} dias contados da publicação do ato de provimento.`,
  ].join("\n");
}

async function changeSource(source: Pick<Source, "id" | "language">, text: string) {
  const contentHash = `hash-${randomUUID()}`;

  const { contentHash: previousHash } = await prisma.source.findUniqueOrThrow({
    select: { contentHash: true },
    where: { id: source.id },
  });

  await prisma.source.update({
    data: { contentHash, extractedText: text },
    where: { id: source.id },
  });

  return recordSourceChangeNotice({
    contentHash,
    fields: ["text"],
    language: source.language,
    message: "The source changed.",
    previousHash,
    provenance: PROVENANCE,
    sourceId: source.id,
  });
}

function modelOutput<T>(data: T) {
  return {
    data,
    provenance: { ...PROVENANCE, generatedAt: new Date().toISOString(), runId: randomUUID() },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

function mockDraft(during?: () => Promise<unknown>) {
  vi.mocked(writeLessonDraft).mockImplementationOnce(async () => {
    await during?.();
    return modelOutput(writtenTemperatureLesson()) as never;
  });
}

async function sharedLessonWithSource() {
  const workflowRunId = randomUUID();
  const user = await userFixture();

  const [skill, lesson, goal, guidance] = await Promise.all([
    skillFixture({ name: "Add a rise to a temperature below zero" }),
    libraryLessonFixture({
      contentRunId: workflowRunId,
      contentStatus: "running",
      spec: temperatureSpec(),
      specStatus: "completed",
    }),
    goalFixture({ userId: user.id }),
    sourceFixture({
      extractedText: forecastText("from −3 °C, a rise of 5 degrees reads 2 °C."),
      mimeType: PDF_CONTENT_TYPE,
      publisher: "National Weather Service",
      title: "Reading temperature forecasts",
    }),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    planItemFixture({ lessonId: lesson.id, phase: 0, planId: plan.id, position: 0 }),
    learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: guidance.id,
      userId: user.id,
    }),
  ]);

  return { guidance, lesson, workflowRunId };
}

function listOpenFlags(target: { itemId: string } | { lessonId: string }) {
  return prisma.contentReviewFlag.findMany({ where: { ...target, status: "open" } });
}

async function lawGoal() {
  const user = await userFixture();
  const blueprint = await examBlueprintFixture({ board: "Cebraspe", language: "pt" });

  const [goal, skill, law] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id }),
    skillFixture({ name: "Lei nº 8.112" }),
    sourceFixture({
      extractedText: lawText("trinta"),
      language: "pt",
      title: "Lei nº 8.112, de 11 de dezembro de 1990",
      url: "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
    }),
  ]);

  await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Basics" }],
        skills: [
          { area: "Law", lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: 3 },
        ],
      },
    }),
    learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: law.id,
      userId: user.id,
    }),
  ]);

  return { goal, law };
}

function drill(days: string) {
  return {
    context: null,
    difficulty: "medium" as const,
    format: "trueFalse" as const,
    image: null,
    isTrue: true,
    misconception: null,
    reason: `O art. 13 fixa ${days} dias para a posse.`,
    reference: "Art. 13",
    statement: `A posse ocorrerá no prazo de ${days} dias contados da publicação do ato.`,
    visual: null,
  };
}

async function writeDrill({ days, goalId }: { days: string; goalId: string }) {
  const [target] = await loadStatuteDrillTargets(goalId);

  if (!target) {
    throw new Error("No law to drill");
  }

  return {
    target,
    write: () =>
      writeStatuteDrills({
        drills: [drill(days)],
        optionCount: 4,
        provenance: { ...PROVENANCE, generatedAt: new Date().toISOString(), runId: randomUUID() },
        target,
      }),
  };
}

describe("content written while its source changes", () => {
  it("flags a lesson written from a source's old text when the change lands while it's written", async () => {
    const { guidance, lesson, workflowRunId } = await sharedLessonWithSource();

    mockDraft(() =>
      changeSource(guidance, forecastText("from −3 °C, a rise of 5 degrees reads 3 °C.")),
    );

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { status: "published" },
    );

    await expect(listOpenFlags({ lessonId: lesson.id })).resolves.toHaveLength(1);
  });

  it("flags a lesson written from a source before its screens are cited", async () => {
    const { guidance, lesson, workflowRunId } = await sharedLessonWithSource();

    mockDraft();
    await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    const notice = await changeSource(
      guidance,
      forecastText("from −3 °C, a rise of 5 degrees reads 3 °C."),
    );

    await expect(listOpenFlags({ lessonId: lesson.id })).resolves.toMatchObject([
      { noticeId: notice.id },
    ]);
  });

  it("keeps a lesson flagged when its rewrite read text the source changed during the rewrite", async () => {
    const { guidance, lesson, workflowRunId } = await sharedLessonWithSource();

    mockDraft();
    await writeLessonContent({ lessonId: lesson.id, workflowRunId });
    await changeSource(guidance, forecastText("from −3 °C, a rise of 5 degrees reads 3 °C."));

    const rewriteRunId = randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: null, contentStatus: "failed" },
      where: { id: lesson.id },
    });

    await claimLibraryGeneration({
      id: lesson.id,
      target: "lessonContent",
      workflowRunId: rewriteRunId,
    });

    mockDraft(() =>
      changeSource(guidance, forecastText("from −3 °C, a rise of 5 degrees reads 4 °C.")),
    );

    await expect(
      writeLessonContent({ lessonId: lesson.id, workflowRunId: rewriteRunId }),
    ).resolves.toMatchObject({ check: { version: 2 }, status: "published" });

    await expect(listOpenFlags({ lessonId: lesson.id })).resolves.not.toHaveLength(0);
  });

  it("flags a law's drill whose model call ended after the law changed", async () => {
    const { goal, law } = await lawGoal();
    const { write } = await writeDrill({ days: "trinta", goalId: goal.id });

    await changeSource(law, lawText("quinze"));

    await expect(write()).resolves.toBe(1);

    const item = await prisma.item.findFirstOrThrow({ where: { sourceId: law.id } });
    await expect(listOpenFlags({ itemId: item.id })).resolves.toHaveLength(1);
  });

  it("keeps a rewritten drill flagged for a change its rewrite never read", async () => {
    const { goal, law } = await lawGoal();
    const { write } = await writeDrill({ days: "trinta", goalId: goal.id });
    await write();

    const item = await prisma.item.findFirstOrThrow({ where: { sourceId: law.id } });
    const first = await changeSource(law, lawText("quinze"));
    const flag = await prisma.contentReviewFlag.findFirstOrThrow({ where: { noticeId: first.id } });

    const {
      drillGroups: [group],
    } = await prepareFlaggedContent({ flagIds: [flag.id] });

    if (!group) {
      throw new Error("No drill group");
    }

    expect(group.article.text).toContain("quinze dias");

    const second = await changeSource(law, lawText("dez"));

    await expect(
      replaceFlaggedDrills({
        drills: [drill("quinze")],
        group,
        optionCount: 4,
        provenance: { ...PROVENANCE, generatedAt: new Date().toISOString() },
      }),
    ).resolves.toBe(1);

    await expect(listOpenFlags({ itemId: item.id })).resolves.toContainEqual(
      expect.objectContaining({ noticeId: second.id }),
    );
  });

  it("keeps a lesson flagged when a fix staged after the change rewrote only some of its screens", async () => {
    const { guidance, lesson, workflowRunId } = await sharedLessonWithSource();

    mockDraft();
    const written = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    if (written.status !== "published") {
      throw new Error(`The test lesson wasn't published: ${written.status}`);
    }

    await completeLessonContent({ lessonId: lesson.id, workflowRunId });
    await changeSource(guidance, forecastText("from −3 °C, a rise of 5 degrees reads 3 °C."));

    vi.mocked(checkLessonQuality).mockResolvedValueOnce(
      modelOutput({
        issues: [
          {
            fix: "Say that a rise moves up the thermometer.",
            kind: "incorrect" as const,
            problem: "The screen says a rise moves the mark down below zero.",
            screen: 4,
            severity: "blocking" as const,
          },
        ],
      }) as never,
    );

    vi.mocked(fixLessonDraft).mockResolvedValueOnce(
      modelOutput({
        changedScreens: [4],
        lesson: {
          ...writtenTemperatureLesson(),
          screens: writtenTemperatureLesson().screens.map((screen, index) =>
            index === 4 && screen.kind === "explanation"
              ? { ...screen, text: "A rise moves the mark up, even below zero." }
              : screen,
          ),
        },
      }) as never,
    );

    await expect(
      checkPublishedLesson({
        lessonId: lesson.id,
        plan: written.check,
        workflowRunId: randomUUID(),
      }),
    ).resolves.toMatchObject({ status: "republished", version: 2 });

    await expect(publishFixedVersion({ lessonId: lesson.id, version: 2 })).resolves.toBe(true);
    await expect(listOpenFlags({ lessonId: lesson.id })).resolves.not.toHaveLength(0);
  });

  it("publishes a staged fix while a notice flags the same lesson, without a deadlock", async () => {
    const { guidance, lesson, workflowRunId } = await sharedLessonWithSource();

    mockDraft();
    await writeLessonContent({ lessonId: lesson.id, workflowRunId });
    await completeLessonContent({ lessonId: lesson.id, workflowRunId });

    const version = await stageLessonVersion({
      language: "en",
      lessonId: lesson.id,
      replaces: 1,
      screens: [
        {
          content: { text: "A rise moves the mark up, even below zero.", title: "Up is up" },
          kind: "explanation",
          mathItem: null,
          provenance: {
            ...PROVENANCE,
            sources: [{ contentHash: guidance.contentHash, sourceId: guidance.id }],
          },
          skillId: null,
        },
      ],
      summary: { ideas: [], shape: "hub" },
    });

    const held = Promise.withResolvers<number>();
    const released = Promise.withResolvers<null>();

    const noticing = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sources WHERE id = ${guidance.id}::uuid FOR NO KEY UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await released.promise;

      const { contentHash } = await tx.source.update({
        data: { contentHash: `hash-${randomUUID()}` },
        where: { id: guidance.id },
      });

      return createSourceChangeNotice({
        data: {
          contentHash,
          examBlueprintId: null,
          fields: ["text"],
          generatedAt: new Date(),
          language: "en",
          message: "The source changed.",
          model: "test/model",
          previousHash: guidance.contentHash,
          promptVersion: "v1",
          runId: "r1",
          sourceId: guidance.id,
        },
        tx,
      });
    });

    noticing.catch((error: unknown) => held.reject(error));
    const pid = await held.promise;
    const publishing = publishStagedLessonVersion({ lessonId: lesson.id, version: version ?? 0 });

    try {
      await waitForBlockedStatement(pid, /FOR SHARE/u);
    } finally {
      released.resolve(null);
    }

    const settled = await Promise.allSettled([noticing, publishing]);
    expect(settled.map((result) => result.status)).toStrictEqual(["fulfilled", "fulfilled"]);
    await expect(listOpenFlags({ lessonId: lesson.id })).resolves.toHaveLength(1);
  });
});
