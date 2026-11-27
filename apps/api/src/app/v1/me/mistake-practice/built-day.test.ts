import { randomUUID } from "node:crypto";
import {
  mistakePracticeFeedbackSchema,
  mistakePracticeResponseSchema,
} from "@/lib/openapi/schemas/mistakes";
import { openedStudyDayResponseSchema } from "@/lib/openapi/schemas/open-study-day";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionPlanFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../../../../../../packages/core/src/_test-utils/mock-session";
import { POST as openStudyDay } from "../../goals/[goalId]/study-sessions/route";
import { POST as answerMistake } from "../mistakes/[mistakeId]/answers/route";
import { POST as finishPractice } from "./completions/route";
import { GET as readPractice } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

const SHOWN_DATE = "2026-09-30";
const NOW = new Date(`${SHOWN_DATE}T12:00:00Z`);
const ORIGIN = "http://localhost/v1";

function post(path: string, body: object) {
  return new NextRequest(`${ORIGIN}${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

async function assignedMistakes(userId: string) {
  const goal = await goalFixture({
    dailyMinutes: 60,
    details: { placementDeclined: true },
    timezone: "UTC",
    userId,
  });

  const { items, skills } = await studySessionPlanFixture({ goal });

  const mistakes = await Promise.all(
    skills.map((skill, index) => {
      const item = items.find(({ skillId }) => skillId === skill.id);

      if (!item) {
        throw new Error("Each plan skill must have a bank item");
      }

      return mistakeFixture({
        createdAt: new Date(NOW.getTime() - (skills.length - index) * MS_PER_DAY),
        itemId: item.id,
        skillId: skill.id,
        userId,
      });
    }),
  );

  return { goal, mistakes };
}

describe("mistake practice from a built study day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("asks the saved assignment in order and completes once when a retired entry is left", async () => {
    const user = await userFixture();
    const { goal, mistakes } = await assignedMistakes(user.id);
    const [first, retired, last] = mistakes;
    mockSession(user.id);

    const opened = await openStudyDay(
      post(`/goals/${goal.id}/study-sessions`, {
        shownDate: SHOWN_DATE,
        target: { kind: "next", shown: null },
        timeZone: "UTC",
      }),
      { params: Promise.resolve({ goalId: goal.id }) },
    );

    expect(opened.status).toBe(201);
    const day = openedStudyDayResponseSchema.parse(await opened.json());
    const [block] = day.session.blocks;

    if (block?.screen !== "mistakesPractice" || !first?.skillId || !retired?.itemId || !last) {
      throw new Error("The built day must start with three assigned mistakes");
    }

    expect(day.opening).toMatchObject({ blockId: block.id, kind: "mistakesPractice" });

    const outside = await itemFixture({ content: choiceItemContent(), skillId: first.skillId });

    await mistakeFixture({
      createdAt: first.createdAt,
      itemId: outside.id,
      skillId: first.skillId,
      userId: user.id,
    });

    const get = () =>
      readPractice(new NextRequest(`${ORIGIN}/me/mistake-practice?blockId=${block.id}`));

    const row = () => prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
    const ids = mistakes.map(({ id }) => id);

    await expect(row()).resolves.toMatchObject({ payload: { mistakeIds: ids } });
    const practice = await get();
    expect(practice.status).toBe(200);

    expect(
      mistakePracticeResponseSchema
        .parse(await practice.json())
        .practice.map(({ mistakeId }) => mistakeId),
    ).toStrictEqual(ids);

    await prisma.item.update({ data: { retiredAt: NOW }, where: { id: retired.itemId } });

    const afterRetirement = await get();

    expect(
      mistakePracticeResponseSchema
        .parse(await afterRetirement.json())
        .practice.map(({ mistakeId }) => mistakeId),
    ).toStrictEqual([first.id, last.id]);

    const answer = async (mistake: typeof first, answerIds: string[]) => {
      const reply = await answerMistake(
        post(`/me/mistakes/${mistake.id}/answers`, {
          answer: { selectedIndex: 0 },
          attemptId: randomUUID(),
          durationMs: 4000,
          itemId: mistake.itemId,
          run: { answerIds, blockId: block.id },
          timeZone: "UTC",
        }),
        { params: Promise.resolve({ mistakeId: mistake.id }) },
      );

      expect(reply.status).toBe(200);
      const feedback = mistakePracticeFeedbackSchema.parse(await reply.json());
      expect(feedback.fixed).toBe(true);
      return feedback.answerId;
    };

    const firstAnswer = await answer(first, []);
    await expect(row()).resolves.toMatchObject({ completedAt: null, status: "active" });
    const lastAnswer = await answer(last, [firstAnswer]);
    const completed = await row();
    expect(completed).toMatchObject({ completedAt: expect.any(Date), status: "completed" });

    vi.setSystemTime(new Date(NOW.getTime() + 1000));

    const finish = await finishPractice(
      post("/me/mistake-practice/completions", {
        answerIds: [firstAnswer, lastAnswer],
        blockId: block.id,
        ended: true,
        timeZone: "UTC",
      }),
    );

    expect(finish.status).toBe(200);
    await expect(row()).resolves.toStrictEqual(completed);
  });
});
