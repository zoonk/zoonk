import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { gradeSessionAnswer, parseSessionItem } from "../sessions/_utils/session-items";
import { getMistakePractice } from "./get-mistake-practice";
import { readMistakeSnapshot } from "./mistake-snapshot";

describe("legacy original identity", () => {
  it.each(["answer", "context"] as const)(
    "does not replace a legacy original after its %s changes under the same prompt",
    async (change) => {
      const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

      const content = {
        ...choiceItemContent("Which answer follows this rule?"),
        context: "The original passage.",
      };

      const original = await itemFixture({ content, skillId: skill.id });
      const parsed = parseSessionItem(original);

      if (!parsed) {
        throw new Error("Expected the original question");
      }

      const oldGrade = gradeSessionAnswer({
        answer: { selectedIndex: 1 },
        blockId: original.id,
        item: parsed,
      });

      const snapshot = readMistakeSnapshot(oldGrade.snapshot);

      const mistake = await mistakeFixture({
        createdAt: new Date(Date.now() - 86_400_000),
        itemId: original.id,
        skillId: original.skillId,
        snapshot,
        userId: user.id,
      });

      const edited = await prisma.item.update({
        data: {
          content:
            change === "answer"
              ? {
                  ...content,
                  options: content.options.map((option) => ({
                    ...option,
                    isCorrect: !option.isCorrect,
                  })),
                }
              : { ...content, context: "A changed passage with different assumptions." },
        },
        where: { id: original.id },
      });

      mockSession(user.id);

      await expect(getMistakePractice({ includeAllFormats: true })).resolves.toMatchObject({
        practice: [],
        status: "ready",
      });

      const item = parseSessionItem(edited);

      if (!item) {
        throw new Error("Expected the edited question");
      }

      const wrong = gradeSessionAnswer({ answer: { dontKnow: true }, blockId: item.id, item });

      const recorded = await recordLearnerAnswer({
        answer: wrong.recorded,
        graded: { durationMs: 2000, isCorrect: false },
        itemId: item.id,
        language: item.language,
        mistake: { questionText: wrong.snapshot.question, snapshot: wrong.snapshot },
        purpose: "learning",
        skillId: item.skillId,
        timeZone: "UTC",
        userId: user.id,
      });

      expect(recorded.mistake?.id).not.toBe(mistake.id);

      await expect(prisma.mistake.findUnique({ where: { id: mistake.id } })).resolves.toMatchObject(
        { snapshot, status: "open" },
      );
    },
  );
});
