import { generateSourceChangeNotice } from "@zoonk/ai/tasks/research/source-change-notice";
import { storeWebSource } from "@zoonk/core/library/sources/web";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { freshnessWorkflow } from "./freshness-workflow";

vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetch: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/source-change-notice", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateSourceChangeNotice: vi.fn(),
}));

function serveLaw(text: string) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(text, { headers: { "content-type": "text/plain" } }),
  );
}

describe("law change durability", () => {
  it("leaves a law change whose notice used up its retries for the next check", async () => {
    serveLaw("Art. 1º A alíquota é de 15%.");

    const law = await storeWebSource({
      kind: "official",
      language: "pt",
      publisher: "Presidência da República",
      title: "Lei nº 99.999/2026",
      topic: "regulation",
      url: `https://www.planalto.gov.br/${crypto.randomUUID()}`,
    });

    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await learnerSourceFixture({ goalId: goal.id, sourceId: law.id, userId: user.id });

    serveLaw("Art. 1º A alíquota é de 17%.");
    vi.mocked(generateSourceChangeNotice).mockRejectedValue(new Error("Gateway timeout"));

    const failed = await start(freshnessWorkflow, [{ kind: "source", sourceId: law.id }]);
    await expect(failed.returnValue).rejects.toThrow();

    vi.mocked(generateSourceChangeNotice).mockResolvedValue(
      taskResult({ message: "A lei mudou: a alíquota agora é de 17%." }, "openai/gpt-6-luna"),
    );

    const next = await start(freshnessWorkflow, [{ kind: "source", sourceId: law.id }]);
    await expect(next.returnValue).resolves.toMatchObject({ status: "checked" });

    await expect(
      prisma.sourceChangeNotice.findMany({ where: { sourceId: law.id } }),
    ).resolves.toMatchObject([
      { message: "A lei mudou: a alíquota agora é de 17%.", previousHash: law.contentHash },
    ]);
  });
});
