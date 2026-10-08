import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import { saveLessonContent } from "../lessons/_utils/save-lesson-content";
import { createSourceChangeNotice, resolveReviewFlags } from "../sources/content-review-flags";
import { recordSourceChangeNotice } from "../sources/source-change-notices";
import { listFlaggedContent } from "./flagged-content";
import { dismissReviewFlagForAdmin, getOpenReviewFlagForAdmin } from "./review-flags-admin";
import { replaceFlaggedDrills } from "./rewrite-flagged-drills";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

function mockAdminSession(userId: string) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

const DAY_MS = 86_400_000;

const LAW_TEXT = [
  "Art. 13. A posse ocorrerá no prazo de trinta dias contados da publicação do ato de provimento.",
  "Art. 14. A posse em cargo público dependerá de prévia inspeção médica oficial.",
].join("\n");

const PROVENANCE = {
  generatedAt: new Date(),
  model: "test/model",
  promptVersion: "v1",
  runId: "r1",
};

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

function noticeFor(sourceId: string) {
  return recordSourceChangeNotice({
    contentHash: `new-${crypto.randomUUID()}`,
    fields: ["text"],
    language: "pt",
    message: "A lei mudou: a posse agora ocorre em quinze dias.",
    previousHash: "old",
    provenance: PROVENANCE,
    sourceId,
  });
}

/** A changed law with a lesson citing it and a drill on its Art. 13, both written before. */
async function lawWithDependents() {
  const [law, skill] = await Promise.all([
    sourceFixture({
      extractedText: LAW_TEXT,
      language: "pt",
      title: "Lei nº 8.112, de 11 de dezembro de 1990",
    }),
    skillFixture(),
  ]);

  const [citing, other] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "completed" }),
  ]);

  const [drill, later] = await Promise.all([
    itemFixture({
      format: "trueFalse",
      generatedAt: daysAgo(3),
      language: "pt",
      skillId: skill.id,
      sourceCitation: "Lei nº 8.112, Art. 13",
      sourceId: law.id,
    }),
    itemFixture({ generatedAt: daysAgo(-1), skillId: skill.id, sourceId: law.id }),
    libraryStepFixture({ generatedAt: daysAgo(3), lessonId: citing.id, sourceId: law.id }),
    libraryStepFixture({ generatedAt: daysAgo(3), lessonId: other.id }),
  ]);

  return { citing, drill, later, law, other };
}

describe("flags on a changed source", () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("flags the lessons citing the source and the questions written from it before the change", async () => {
    const { citing, drill, later, law, other } = await lawWithDependents();

    const notice = await noticeFor(law.id);

    const flags = await prisma.contentReviewFlag.findMany({ where: { noticeId: notice.id } });

    expect(flags.map((flag) => flag.lessonId ?? flag.itemId)).toStrictEqual(
      expect.arrayContaining([citing.id, drill.id]),
    );

    expect(flags).toHaveLength(2);

    expect(flags.every((flag) => flag.status === "open")).toBe(true);
    expect(flags.map((flag) => flag.lessonId)).not.toContain(other.id);
    expect(flags.map((flag) => flag.itemId)).not.toContain(later.id);
  });

  it("flags what cites the notice an exam's corrected notice replaces", async () => {
    const [original, erratum] = await Promise.all([
      sourceFixture({ language: "pt", title: "Edital TJ-CE 2026" }),
      sourceFixture({ language: "pt", title: "Retificação do edital TJ-CE 2026" }),
    ]);

    const [blueprint, lesson] = await Promise.all([
      examBlueprintFixture({ language: "pt", sourceId: original.id }),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    await libraryStepFixture({
      generatedAt: daysAgo(2),
      lessonId: lesson.id,
      sourceId: original.id,
    });

    await prisma.$transaction((tx) =>
      createSourceChangeNotice({
        data: {
          contentHash: "new",
          examBlueprintId: blueprint.id,
          fields: ["edition.questionCount"],
          generatedAt: new Date(),
          language: "pt",
          message: "O edital mudou: agora são 60 questões.",
          model: "test/model",
          previousHash: "old",
          promptVersion: "v1",
          runId: "r1",
          sourceId: erratum.id,
        },
        replacedSourceId: blueprint.sourceId,
        tx,
      }),
    );

    await expect(
      prisma.contentReviewFlag.count({ where: { lessonId: lesson.id, status: "open" } }),
    ).resolves.toBe(1);
  });

  it("resolves only the flags raised before the rewritten version", async () => {
    const { citing, law } = await lawWithDependents();
    const first = await noticeFor(law.id);
    const writtenAt = new Date();

    await prisma.$transaction((tx) =>
      resolveReviewFlags({ target: { lessonId: citing.id }, tx, writtenAt }),
    );

    await expect(
      prisma.contentReviewFlag.findFirstOrThrow({
        where: { lessonId: citing.id, noticeId: first.id },
      }),
    ).resolves.toMatchObject({ resolvedAt: writtenAt, status: "rewritten" });
  });
});

describe("a rewritten lesson", () => {
  it("resolves its flags when the new version is saved", async () => {
    const { citing, law } = await lawWithDependents();
    const notice = await noticeFor(law.id);
    const workflowRunId = crypto.randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: workflowRunId, contentStatus: "running" },
      where: { id: citing.id },
    });

    const saved = await saveLessonContent({
      language: "pt",
      lessonId: citing.id,
      screens: [
        {
          content: { text: "A posse ocorre em quinze dias.", title: "A posse" },
          kind: "explanation",
          mathItem: null,
          provenance: PROVENANCE,
          skillId: null,
        },
      ],
      summary: ["A posse ocorre em quinze dias."],
      workflowRunId,
    });

    // The lesson's earlier screens stay as version 1 for learners playing them.
    expect(saved).toBe(2);

    await expect(
      prisma.contentReviewFlag.findFirstOrThrow({
        where: { lessonId: citing.id, noticeId: notice.id },
      }),
    ).resolves.toMatchObject({ status: "rewritten" });
  });
});

describe("the flag sweep", () => {
  it("lists flagged lessons and groups a changed law's drills with the article's new text", async () => {
    const { citing, drill, law } = await lawWithDependents();
    const notice = await noticeFor(law.id);

    const flags = await prisma.contentReviewFlag.findMany({ where: { noticeId: notice.id } });
    const flagIds = flags.map((flag) => flag.id);

    const flagged = await listFlaggedContent({ flagIds });

    expect(flagged.lessonIds).toStrictEqual([citing.id]);

    expect(flagged.drillGroups).toStrictEqual([
      {
        article: { reference: "Art. 13", text: expect.stringContaining("trinta dias") },
        citation: "Lei nº 8.112, Art. 13",
        format: "trueFalse",
        itemIds: [drill.id],
        language: "pt",
        law: {
          shortName: "Lei nº 8.112",
          title: "Lei nº 8.112, de 11 de dezembro de 1990",
          url: law.url,
        },
        sourceId: law.id,
        style: "cebraspe",
      },
    ]);
  });

  it("writes a law's new drill in place of the flagged one and resolves its flag", async () => {
    const { drill, law } = await lawWithDependents();
    const notice = await noticeFor(law.id);

    const flag = await prisma.contentReviewFlag.findFirstOrThrow({
      where: { itemId: drill.id, noticeId: notice.id },
    });

    const { drillGroups } = await listFlaggedContent({ flagIds: [flag.id] });
    const [group] = drillGroups;

    if (!group) {
      throw new Error("No drill group");
    }

    const rewritten = await replaceFlaggedDrills({
      drills: [
        {
          context: null,
          difficulty: "medium",
          format: "trueFalse",
          image: null,
          isTrue: true,
          misconception: null,
          reason: "O art. 13 fixa trinta dias para a posse.",
          reference: "Art. 13",
          statement: "A posse ocorrerá no prazo de trinta dias contados da publicação do ato.",
          visual: null,
        },
      ],
      group,
      optionCount: 4,
      provenance: { ...PROVENANCE, generatedAt: new Date().toISOString(), runId: "drills-run" },
    });

    expect(rewritten).toBe(1);

    const [item, resolved] = await Promise.all([
      prisma.item.findUniqueOrThrow({ where: { id: drill.id } }),
      prisma.contentReviewFlag.findUniqueOrThrow({ where: { id: flag.id } }),
    ]);

    expect(item).toMatchObject({
      content: expect.objectContaining({ statement: expect.stringContaining("trinta dias") }),
      runId: "drills-run:0",
      sourceCitation: "Lei nº 8.112, Art. 13",
    });

    expect(resolved.status).toBe("rewritten");
  });

  it("leaves drills on an article the new text dropped for admins", async () => {
    const { drill, law } = await lawWithDependents();

    await prisma.source.update({
      data: { extractedText: "Art. 14. A posse depende de inspeção médica oficial e prévia." },
      where: { id: law.id },
    });

    const notice = await noticeFor(law.id);

    const flag = await prisma.contentReviewFlag.findFirstOrThrow({
      where: { itemId: drill.id, noticeId: notice.id },
    });

    await expect(listFlaggedContent({ flagIds: [flag.id] })).resolves.toMatchObject({
      drillGroups: [],
    });
  });
});

describe("review flags in admin", () => {
  it("lets only admins dismiss a flag or start its rewrite", async () => {
    const { law } = await lawWithDependents();
    const notice = await noticeFor(law.id);

    const flag = await prisma.contentReviewFlag.findFirstOrThrow({
      where: { noticeId: notice.id },
    });

    const [learner, admin] = await Promise.all([userFixture(), userFixture({ role: "admin" })]);

    mockSession(learner.id);

    await expect(dismissReviewFlagForAdmin(flag.id)).resolves.toStrictEqual({
      status: "forbidden",
    });

    mockAdminSession(admin.id);

    await expect(getOpenReviewFlagForAdmin(flag.id)).resolves.toStrictEqual({
      flagId: flag.id,
      status: "ready",
    });

    await expect(dismissReviewFlagForAdmin(flag.id)).resolves.toStrictEqual({ status: "ready" });

    await expect(
      prisma.contentReviewFlag.findUniqueOrThrow({ where: { id: flag.id } }),
    ).resolves.toMatchObject({ status: "dismissed" });

    await expect(getOpenReviewFlagForAdmin(flag.id)).resolves.toStrictEqual({ status: "notFound" });
  });
});
