import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockSession } from "../../../../../../../../../../packages/core/src/_test-utils/mock-session";
import { learnerGoalFixture } from "../../../../../../../../../../packages/core/src/learner/_test-utils/learner-goal";
import { POST as generate } from "./generations/route";
import { GET as getTestOut, POST as submitTestOut } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("chapter test-out with nothing left to skip", () => {
  it("exposes the outcome for reads, question requests, and new submissions without starting a run", async () => {
    const user = await userFixture();

    const { goal, chapters, planItems, items } = await learnerGoalFixture({
      itemsPerSkill: 1,
      phases: [4],
      userId: user.id,
    });

    mockSession(user.id);

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { id: { in: planItems.map((item) => item.id) } },
    });

    const chapterId = chapters[0]?.id ?? "";
    const url = `http://localhost/v1/goals/${goal.id}/chapters/${chapterId}/test-out`;
    const context = { params: Promise.resolve({ chapterId, goalId: goal.id }) };

    const responses = await Promise.all([
      getTestOut(new NextRequest(url), context),
      generate(new NextRequest(`${url}/generations`, { method: "POST" }), context),
      submitTestOut(
        new NextRequest(url, {
          body: JSON.stringify({
            answers: items.map((item) => ({
              answer: { selectedIndex: 0 },
              durationMs: 8000,
              itemId: item.id,
            })),
            requestId: randomUUID(),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
        context,
      ),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([200, 200, 200]);

    await expect(Promise.all(responses.map((response) => response.json()))).resolves.toStrictEqual(
      Array.from({ length: 3 }, () => ({ status: "nothingToSkip" })),
    );

    expect(start).not.toHaveBeenCalled();
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
