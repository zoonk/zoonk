import { waitForSleep } from "@workflow/vitest";
import { generateStatuteDrills } from "@zoonk/ai/tasks/items/statute-drills";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { prisma } from "@zoonk/db";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture, unnoticedSourceChangeFixture } from "@zoonk/testing/fixtures/sources";
import { assert, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { flaggedContentWorkflow } from "./flagged-content-workflow";

vi.mock("@zoonk/ai/tasks/items/statute-drills", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateStatuteDrills: vi.fn(),
}));

const DAY_MS = 86_400_000;

const DRILLS = {
  drills: [
    {
      context: null,
      difficulty: "medium" as const,
      format: "trueFalse" as const,
      image: null,
      isTrue: true,
      misconception: null,
      reason: "O art. 13 agora fixa quinze dias.",
      reference: "Art. 13",
      statement: "A posse ocorrerá no prazo de quinze dias contados da publicação do ato.",
      visual: null,
    },
  ],
  dropped: [],
};

function drillsResult() {
  return taskResult(DRILLS) as Awaited<ReturnType<typeof generateStatuteDrills>>;
}

async function flaggedDrill() {
  const [law, skill] = await Promise.all([
    sourceFixture({
      extractedText:
        "Art. 13. A posse ocorrerá no prazo de quinze dias contados da publicação do ato de provimento.",
      language: "pt",
      title: "Lei nº 8.112, de 11 de dezembro de 1990",
    }),
    skillFixture(),
  ]);

  await itemFixture({
    format: "trueFalse",
    generatedAt: new Date(Date.now() - DAY_MS),
    language: "pt",
    skillId: skill.id,
    sourceCitation: "Lei nº 8.112, Art. 13",
    sourceId: law.id,
  });

  const owed = await unnoticedSourceChangeFixture({ previousHash: "old", sourceId: law.id });

  const notice = await recordSourceChangeNotice({
    changedAt: owed.changedAt,
    contentHash: "new",
    fields: ["text"],
    language: "pt",
    message: "A lei mudou: a posse agora ocorre em quinze dias.",
    previousHash: owed.previousHash,
    provenance: { generatedAt: new Date(), model: "test", promptVersion: "v1", runId: "r1" },
    sourceId: law.id,
  });

  assert(notice, "The owed change should get its notice.");
  const flags = await prisma.contentReviewFlag.findMany({ where: { noticeId: notice.id } });
  return flags.map((flag) => flag.id);
}

describe("flagged content turns", () => {
  it("makes Rewrite now wait while the sweep's run rewrites the same drills, so they're written once", async () => {
    const flagIds = await flaggedDrill();
    const writing = Promise.withResolvers<null>();
    const written = Promise.withResolvers<null>();
    const rewroteToo = Promise.withResolvers<null>();

    vi.mocked(generateStatuteDrills)
      .mockImplementationOnce(async () => {
        writing.resolve(null);
        await written.promise;
        return drillsResult();
      })
      .mockImplementation(async () => {
        rewroteToo.resolve(null);
        return drillsResult();
      });

    const sweep = await start(flaggedContentWorkflow, [{}]);
    await writing.promise;

    const rewrite = await start(flaggedContentWorkflow, [{ flagIds }]);
    const turn = await Promise.race([waitForSleep(rewrite), rewroteToo.promise]);
    expect(generateStatuteDrills).toHaveBeenCalledOnce();
    assert(turn);
    written.resolve(null);

    await expect(sweep.returnValue).resolves.toStrictEqual({
      drillsRewritten: 1,
      lessonsPulled: [],
    });

    await rewrite.wakeUp({ correlationIds: [turn] });

    await expect(rewrite.returnValue).resolves.toStrictEqual({
      drillsRewritten: 0,
      lessonsPulled: [],
    });

    expect(generateStatuteDrills).toHaveBeenCalledOnce();
  });
});
