import { courseOutlineWorkflow } from "@/workflows/courses/course-outline-workflow";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockSession } from "../../../../../../../../../../../packages/core/src/_test-utils/mock-session";
import { POST as writeOutline } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

/** Past the two weeks the plan writes ahead. */
const FAR_DAYS = 60;

async function farTopic() {
  const [user, course, skill] = await Promise.all([
    userFixture(),
    courseFixture({ language: "en", outlineStatus: "running" }),
    skillFixture({ level: "beginner" }),
  ]);

  const goal = await goalFixture({ timezone: "UTC", userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "One" }],
      skills: [
        {
          area: null,
          courseIds: [course.id],
          lessons: 12,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
  });

  await planItemFixture({
    planId: plan.id,
    position: 0,
    scheduledFor: new Date(Date.now() + FAR_DAYS * MS_PER_DAY),
    skillId: skill.id,
  });

  mockSession(user.id);

  const ask = () =>
    writeOutline(
      new NextRequest(
        `http://localhost/v1/goals/${goal.id}/skills/${skill.id}/outline/generations`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ goalId: goal.id, skillId: skill.id }) },
    );

  return { ask, course, goal, skill };
}

describe("POST /v1/goals/{goalId}/skills/{skillId}/outline/generations", () => {
  it("starts the topic's outline while another run writes its course, and a retry after a failed start starts it again", async () => {
    const { ask, course, goal, skill } = await farTopic();

    vi.mocked(start).mockRejectedValueOnce(new Error("Queue unavailable"));
    const failed = await ask();

    expect(failed.status).toBe(500);
    await expect(prisma.skillOutlineAsk.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    vi.mocked(start).mockResolvedValueOnce({ runId: "wrun_outline" } as Awaited<
      ReturnType<typeof start>
    >);

    const response = await ask();

    expect(response.status).toBe(202);

    await expect(response.json()).resolves.toStrictEqual({
      generationId: "wrun_outline",
      status: "writing",
    });

    expect(vi.mocked(start).mock.lastCall).toStrictEqual([
      courseOutlineWorkflow,
      [
        expect.objectContaining({
          ask: expect.objectContaining({ goalId: goal.id, skillId: skill.id }),
          courseId: course.id,
          waitedSkillId: skill.id,
        }),
      ],
    ]);
  });
});
