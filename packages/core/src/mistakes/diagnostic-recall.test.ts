import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { getChapterTestOut } from "../learner/test-out/get-chapter-test-out";
import { submitChapterTestOut } from "../learner/test-out/submit-chapter-test-out";
import { getFocusTest } from "../plans/focus-test/get-focus-test";
import { submitFocusTest } from "../plans/focus-test/submit-focus-test";
import { parsePlanGraph } from "../plans/planner/plan-state";

describe("diagnostic recall of notebook originals", () => {
  it.each(["chapter", "focus"] as const)(
    "fixes the original pictured question after a correct %s test answer on a later day",
    async (kind) => {
      const user = await userFixture();

      const { chapters, goal, items, plan } = await learnerGoalFixture({
        itemsPerSkill: 1,
        phases: [4, 4],
        userId: user.id,
      });

      const asset = await mediaAssetFixture();

      const content = {
        ...choiceItemContent(),
        image: { alt: "The original diagram", prompt: "The original diagram" },
      };

      const [row] = await Promise.all([
        prisma.item.update({
          data: { content, mediaAssetId: asset.id },
          include: { mediaAsset: true },
          where: { id: items[0]?.id },
        }),
        prisma.plan.update({
          data: {
            graph: {
              ...parsePlanGraph(plan.graph),
              skills: parsePlanGraph(plan.graph).skills.map((skill, index) => ({
                ...skill,
                area: index < 4 ? "Math" : "Science",
              })),
            },
          },
          where: { id: plan.id },
        }),
      ]);

      const item = parseChoiceItem(row);

      if (!item) {
        throw new Error("Expected the original choice question");
      }

      const grade = gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item });

      const mistake = await mistakeFixture({
        createdAt: new Date(Date.now() - 86_400_000),
        itemId: item.id,
        skillId: item.skillId,
        snapshot: grade.snapshot,
        userId: user.id,
      });

      mockSession(user.id);
      const chapterId = chapters[0]?.id ?? "";
      const scope = { chapterId, goalId: goal.id };
      const read = await (kind === "chapter" ? getChapterTestOut(scope) : getFocusTest(scope));

      if (read.status !== "ready") {
        throw new Error(`Expected a ready test, got ${read.status}`);
      }

      const questions = "testOut" in read ? read.testOut.questions : read.focusTest.questions;
      expect(questions.find((question) => question.itemId === item.id)?.image?.url).toBe(asset.url);

      const input = {
        answers: questions.map((question) => ({
          answer: { selectedIndex: 0 },
          durationMs: 5000,
          itemId: question.itemId,
        })),
        requestId: crypto.randomUUID(),
      };

      const result = await (kind === "chapter"
        ? submitChapterTestOut({ ...scope, input })
        : submitFocusTest({ ...scope, input }));

      expect(result.status).toBe("ready");

      await expect(prisma.mistake.findUnique({ where: { id: mistake.id } })).resolves.toMatchObject(
        { status: "fixed" },
      );

      await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(1);
    },
  );
});
