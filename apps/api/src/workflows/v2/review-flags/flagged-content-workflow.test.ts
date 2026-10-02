import { generateStatuteDrills } from "@zoonk/ai/tasks/v2/items/statute-drills";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { flaggedContentWorkflow } from "./flagged-content-workflow";
import type * as StatuteDrillsModule from "@zoonk/ai/tasks/v2/items/statute-drills";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// The drill writer is a paid model; its own eval covers what it writes.
vi.mock("@zoonk/ai/tasks/v2/items/statute-drills", async (importOriginal) => ({
  ...(await importOriginal<typeof StatuteDrillsModule>()),
  generateStatuteDrills: vi.fn(),
}));

const LAW_TEXT =
  "Art. 13. A posse ocorrerá no prazo de quinze dias contados da publicação do ato de provimento.";

const DAY_MS = 86_400_000;

function drillResult() {
  return {
    data: {
      drills: [
        {
          context: null,
          difficulty: "medium",
          format: "trueFalse",
          isTrue: true,
          misconception: null,
          reason: "O art. 13 agora fixa quinze dias.",
          reference: "Art. 13",
          statement: "A posse ocorrerá no prazo de quinze dias contados da publicação do ato.",
        },
      ],
      dropped: [],
    },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: "drills-run",
      usage: {},
    },
  } as unknown as Awaited<ReturnType<typeof generateStatuteDrills>>;
}

/** The law's page changed after its drills and lessons were written: every one of them is flagged. */
async function flagLawChange(sourceId: string): Promise<string[]> {
  const notice = await recordSourceChangeNotice({
    contentHash: "new",
    fields: ["text"],
    language: "pt",
    message: "A lei mudou: a posse agora ocorre em quinze dias.",
    previousHash: "old",
    provenance: { generatedAt: new Date(), model: "test", promptVersion: "v1", runId: "r1" },
    sourceId,
  });

  const flags = await prisma.contentReviewFlag.findMany({ where: { noticeId: notice.id } });
  return flags.map((flag) => flag.id);
}

describe(flaggedContentWorkflow, () => {
  beforeEach(() => {
    vi.mocked(start).mockClear();
  });

  it("writes a flagged lesson again from the changed source and a law's drills in place", async () => {
    const [law, skill, lesson] = await Promise.all([
      sourceFixture({
        extractedText: LAW_TEXT,
        language: "pt",
        title: "Lei nº 8.112, de 11 de dezembro de 1990",
      }),
      skillFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    const writtenBefore = new Date(Date.now() - DAY_MS);

    const [drill] = await Promise.all([
      itemFixture({
        format: "trueFalse",
        generatedAt: writtenBefore,
        language: "pt",
        skillId: skill.id,
        sourceCitation: "Lei nº 8.112, Art. 13",
        sourceId: law.id,
      }),
      libraryStepFixture({ generatedAt: writtenBefore, lessonId: lesson.id, sourceId: law.id }),
    ]);

    const flagIds = await flagLawChange(law.id);
    vi.mocked(generateStatuteDrills).mockResolvedValueOnce(drillResult());

    await expect(flaggedContentWorkflow({ flagIds })).resolves.toStrictEqual({
      drillsRewritten: 1,
      lessonsPulled: [lesson.id],
    });

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      { forceReview: true, lessonId: lesson.id },
    ]);

    expect(vi.mocked(generateStatuteDrills).mock.calls[0]?.[0]).toMatchObject({
      articles: [{ reference: "Art. 13", text: expect.stringContaining("quinze dias") }],
      count: 1,
      style: "cebraspe",
    });

    const [pulled, rewritten, drillFlag] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: drill.id } }),
      prisma.contentReviewFlag.findFirstOrThrow({ where: { itemId: drill.id } }),
    ]);

    expect(pulled.contentStatus).toBe("failed");
    expect(rewritten.content).toMatchObject({ statement: expect.stringContaining("quinze dias") });
    expect(drillFlag.status).toBe("rewritten");
  });

  it("keeps a drill flagged when its rewrite fails, and still rewrites the other article's drills", async () => {
    const [law, skill] = await Promise.all([
      sourceFixture({
        extractedText: `${LAW_TEXT}\nArt. 14. O exercício ocorrerá no prazo de quinze dias contados da posse.`,
        language: "pt",
        title: "Lei nº 8.112, de 11 de dezembro de 1990",
      }),
      skillFixture(),
    ]);

    const writtenBefore = new Date(Date.now() - DAY_MS);

    const [rewritten, failed] = await Promise.all(
      ["Art. 13", "Art. 14"].map((article) =>
        itemFixture({
          format: "trueFalse",
          generatedAt: writtenBefore,
          language: "pt",
          skillId: skill.id,
          sourceCitation: `Lei nº 8.112, ${article}`,
          sourceId: law.id,
        }),
      ),
    );

    const flagIds = await flagLawChange(law.id);

    vi.mocked(generateStatuteDrills).mockImplementation(async ({ articles }) => {
      if (articles[0]?.reference === "Art. 14") {
        throw new Error("Provider unavailable");
      }

      return drillResult();
    });

    await expect(flaggedContentWorkflow({ flagIds })).resolves.toStrictEqual({
      drillsRewritten: 1,
      lessonsPulled: [],
    });

    const [rewrittenFlag, failedFlag, failedDrill] = await Promise.all([
      prisma.contentReviewFlag.findFirstOrThrow({ where: { itemId: rewritten?.id } }),
      prisma.contentReviewFlag.findFirstOrThrow({ where: { itemId: failed?.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: failed?.id } }),
    ]);

    expect(rewrittenFlag.status).toBe("rewritten");

    // The next sweep takes the open flag again; until then the drill stays as it was.
    expect(failedFlag.status).toBe("open");
    expect(failedDrill.content).toStrictEqual(failed?.content);
    expect(start).not.toHaveBeenCalled();
  });
});
