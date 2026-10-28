import { prisma } from "@zoonk/db";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type getLessonSkillRows } from "../../library/_utils/shared-rows";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { getChapterTestOut } from "./get-chapter-test-out";
import { requestTestOutQuestions } from "./request-test-out-questions";

// Next's shared cache is a platform boundary absent from Vitest. Keep its real database results
// by serialized arguments to model a Main entry that an API content write cannot expire.
vi.mock("../../library/_utils/shared-rows", async (importOriginal) => {
  const actual = await importOriginal<{ getLessonSkillRows: typeof getLessonSkillRows }>();
  const entries = new Map<string, ReturnType<typeof actual.getLessonSkillRows>>();

  return {
    ...actual,
    getLessonSkillRows: (ids: string[]) => {
      const key = JSON.stringify(ids);
      const entry = entries.get(key) ?? actual.getLessonSkillRows(ids);
      entries.set(key, entry);
      return entry;
    },
  };
});

describe("test-out generation preconditions", () => {
  it("checks the current lesson skills even when its GET warmed an older shared entry", async () => {
    const user = await userFixture();

    const { chapters, goal, planItems } = await learnerGoalFixture({
      itemsPerSkill: 4,
      phases: [1],
      userId: user.id,
    });

    const item = planItems[0]!;
    await prisma.planItem.update({ data: { skillId: null }, where: { id: item.id } });
    mockSession(user.id);
    const input = { chapterId: chapters[0]!.id, goalId: goal.id };
    const before = await getChapterTestOut(input);
    expect(before.status).toBe("ready");

    const added = await skillFixture();
    await lessonSkillFixture({ lessonId: item.lessonId!, skillId: added.id });

    await expect(requestTestOutQuestions(input)).resolves.toMatchObject({
      skillIds: [added.id],
      status: "start",
    });
  });
});
