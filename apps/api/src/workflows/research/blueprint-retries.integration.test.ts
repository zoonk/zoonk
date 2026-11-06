import { readFile } from "node:fs/promises";
import { checkCitedFacts } from "@zoonk/ai/tasks/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/research/check-exam-reading";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { extractQuestionFormats } from "@zoonk/ai/tasks/research/extract-question-formats";
import { translatePassMarks } from "@zoonk/ai/tasks/research/translate-pass-marks";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { hydrateResourceIO, observabilityRevivers } from "workflow/observability";
import { getWorld } from "workflow/runtime";
import { taskResult } from "../_test-utils/recorded-outputs";
import { readNoticeAgainWorkflow } from "../freshness/read-notice-again-workflow";

vi.mock("@zoonk/ai/tasks/research/extract-exam-blueprint", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  extractExamBlueprint: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/check-cited-facts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkCitedFacts: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/extract-question-formats", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  extractQuestionFormats: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/check-exam-reading", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkExamReading: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/translate-pass-marks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  translatePassMarks: vi.fn(),
}));

describe("blueprint extraction durability", () => {
  it("retains the extraction when a cited-fact check fails", async () => {
    const extraction = JSON.parse(
      await readFile(new URL("_test-fixtures/tcdf-2026-extraction.json", import.meta.url), "utf8"),
    ) as BlueprintExtraction;

    const text = await readFile(
      new URL("_test-fixtures/tcdf-2026-notice.txt", import.meta.url),
      "utf8",
    );

    const source = await sourceFixture({ extractedText: text, mimeType: "text/plain" });

    vi.mocked(extractExamBlueprint).mockResolvedValue(taskResult(extraction));

    vi.mocked(extractQuestionFormats).mockResolvedValue(taskResult(extraction.formats));

    vi.mocked(checkExamReading).mockResolvedValue(
      taskResult({ missingSubjects: [], statedCounts: [] }),
    );

    vi.mocked(translatePassMarks).mockResolvedValue(
      taskResult({ language: "pt", translations: {} }),
    );

    vi.mocked(checkCitedFacts).mockRejectedValue(new Error("Fact check unavailable"));
    const blueprint = await examBlueprintFixture({ sourceId: source.id });
    const run = await start(readNoticeAgainWorkflow, [{ examBlueprintId: blueprint.id }]);
    await expect(run.returnValue).rejects.toThrow("Fact check unavailable");
    const world = await getWorld();

    const steps = await world.steps.list({
      pagination: { limit: 100 },
      resolveData: "all",
      runId: run.runId,
    });

    const draftStep = steps.data.find((step) =>
      step.stepName.endsWith("//extractBlueprintDraftStep"),
    );

    if (!draftStep) {
      throw new Error("Draft step missing");
    }

    const output = hydrateResourceIO(draftStep, observabilityRevivers).output;

    expect(output).toMatchObject({
      documents: [{ contentHash: expect.any(String), id: source.id, text, url: source.url }],
    });

    expect(output).toHaveProperty("documents.0");
    const document = (output as { documents: object[] }).documents[0];

    expect(Object.keys(document ?? {}).toSorted()).toStrictEqual([
      "contentHash",
      "id",
      "text",
      "url",
    ]);

    expect(extractExamBlueprint).toHaveBeenCalledOnce();
    expect(extractQuestionFormats).toHaveBeenCalledOnce();
    expect(checkExamReading).toHaveBeenCalledOnce();

    expect(checkCitedFacts).toHaveBeenCalledWith(
      expect.objectContaining({ facts: expect.any(Array) }),
    );
  });
});
