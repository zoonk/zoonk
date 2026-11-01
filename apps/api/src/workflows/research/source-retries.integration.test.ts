import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { findOfficialSources } from "@zoonk/ai/tasks/research/find-official-sources";
import { generateExamResearchPlan } from "@zoonk/ai/tasks/research/plan";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { researchWorkflow } from "./research-workflow";

vi.mock("@zoonk/ai/tasks/identity/search-terms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateSearchTerms: vi.fn(),
}));

vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetch: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/plan", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateExamResearchPlan: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/find-official-sources", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findOfficialSources: vi.fn(),
}));

describe("source download durability", () => {
  it("does not retry permanent downloads or repeat identity generation", async () => {
    vi.mocked(generateSearchTerms).mockResolvedValue(taskResult({ subjects: [{ terms: [] }] }));
    vi.mocked(fetch).mockImplementation(async () => new PageResponse("", { status: 404 }));
    const title = crypto.randomUUID();
    const owner = await userFixture();
    const goal = await goalFixture({ kind: "exam", prompt: title, userId: owner.id });

    vi.mocked(generateExamResearchPlan).mockResolvedValue(
      taskResult({
        board: null,
        classTest: false,
        country: "BR",
        edition: null,
        language: "en",
        name: title,
        officialDomains: ["example.org"],
        queries: [title],
        role: null,
        searchTerms: [title],
      }),
    );

    vi.mocked(findOfficialSources).mockResolvedValue(
      taskResult({
        board: null,
        documents: [
          {
            documentType: "notice",
            kind: "official",
            publisher: null,
            reason: "Notice",
            title,
            url: "https://example.org/missing.pdf",
          },
        ],
        officialFound: true,
        searchCalls: 1,
      }),
    );

    const run = await start(researchWorkflow, [{ goalId: goal.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "needsUpload" });
    expect(generateSearchTerms).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
