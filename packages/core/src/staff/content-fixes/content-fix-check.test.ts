import { prisma } from "@zoonk/db";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import { listOwed } from "../../_test-utils/follow-ups";
import { signInProposer } from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

describe("content fix check", () => {
  it("checks a fix requiring audio without recording the fix or its follow-up", async () => {
    const [proposer, { word }] = await Promise.all([
      signInProposer(),
      languageLessonFixture({ wordText: `rent-${crypto.randomUUID()}` }),
    ]);

    const input = {
      changes: [{ id: word.id, model: "Word", set: { word: "rental" } }],
      reason: "This lesson teaches the noun.",
    };

    const checked = await proposeContentFix(input, { check: true });

    expect(checked).toMatchObject({
      fixes: [
        {
          changes: [{ id: word.id, model: "Word", op: "set" }],
          effects: expect.arrayContaining([{ id: word.id, kind: "voiceOwed", model: "Word" }]),
        },
      ],
      status: "checked",
    });

    await expect(prisma.contentFix.count({ where: { proposerId: proposer.id } })).resolves.toBe(0);
    await expect(listOwed(proposer.id)).resolves.toStrictEqual([]);

    const proposed = await proposeContentFix(input);

    if (checked.status !== "checked" || proposed.status !== "proposed") {
      throw new Error("Expected both the check and proposal to succeed");
    }

    expect(checked.fixes[0]?.changes).toStrictEqual(proposed.fixes[0]?.changes);
    expect(checked.fixes[0]?.effects).toStrictEqual(proposed.fixes[0]?.effects);
    expect(checked.fixes[0]?.media).toMatchObject([{ kind: "clip" }]);
    await expect(listOwed(proposer.id)).resolves.toMatchObject([{ kind: "prepareContentFixMedia" }]);
  });
});
