import { randomUUID } from "node:crypto";
import { startFreshnessCheck } from "@/lib/freshness";
import { generateSourceChangeNotice } from "@zoonk/ai/tasks/research/source-change-notice";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";

vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetch: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/source-change-notice", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateSourceChangeNotice: vi.fn(),
}));

async function lawWithLearner() {
  const law = await sourceFixture({
    extractedText: "Art. 1º A alíquota é de 15%.",
    language: "pt",
    title: "Lei nº 99.999/2026",
    url: `https://www.planalto.gov.br/${randomUUID()}`,
  });

  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  await learnerSourceFixture({
    goalId: goal.id,
    origin: "research",
    sourceId: law.id,
    userId: user.id,
  });

  return law;
}

describe("freshness check starts", () => {
  it("joins a second Check now to the run already checking the law, so one notice is written", async () => {
    const law = await lawWithLearner();
    const fetching = Promise.withResolvers<null>();
    const page = Promise.withResolvers<null>();

    vi.mocked(fetch).mockImplementation(async () => {
      fetching.resolve(null);
      await page.promise;

      return new PageResponse("Art. 1º A alíquota é de 17%.", {
        headers: { "content-type": "text/plain" },
      });
    });

    vi.mocked(generateSourceChangeNotice).mockResolvedValue(
      taskResult({ message: "A lei mudou: a alíquota agora é de 17%." }),
    );

    const target = { kind: "source" as const, sourceId: law.id };
    const first = await startFreshnessCheck(target);
    await fetching.promise;

    const second = await startFreshnessCheck(target);
    page.resolve(null);

    await expect(getRun(first).returnValue).resolves.toMatchObject({ status: "checked" });
    expect(second).toBe(first);
    expect(generateSourceChangeNotice).toHaveBeenCalledOnce();

    await expect(prisma.sourceChangeNotice.count({ where: { sourceId: law.id } })).resolves.toBe(1);
  });
});
