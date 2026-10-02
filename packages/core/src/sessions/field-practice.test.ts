import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { readBlockPayload } from "./block-payload";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

type Details = Record<string, string>;

/** Starting from nothing, so the first week's placement questions stay out of these days. */
const NURSE: Details = { field: "nursing", level: "none", purpose: "work", role: "ICU nurse" };

/**
 * A goal whose only lesson is done, with two general questions, a nursing one and a law one on its
 * skill: studied and not due (a practice day), or due (a review day).
 */
async function fieldDay({ details, due }: { details: Details; due: Date }) {
  const user = await userFixture();

  const { goal, planItems, skills } = await sessionGoalFixture({
    itemsPerSkill: 0,
    lessons: 1,
    userId: user.id,
  });

  const skillId = skills[0]?.id ?? "";

  const [general, secondGeneral, nursing, law] = await Promise.all(
    [null, null, "nursing", "law"].map((field) =>
      itemFixture({ content: choiceItemContent(), field, skillId }),
    ),
  );

  await Promise.all([
    prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
    prisma.goal.update({ data: { details }, where: { id: goal.id } }),
    dueSkillFixture({ due, skillId, userId: user.id }),
  ]);

  mockSession(user.id);

  return {
    goalId: goal.id,
    ids: {
      // Questions of the same rank go in the order they were stored.
      general: [general, secondGeneral].map((item) => item?.id ?? "").toSorted(),
      law: law?.id,
      nursing: nursing?.id,
    },
  };
}

async function loadBlocks(goalId: string) {
  const today = await getTodayStudySession({ goalId });
  const sessionId = today.status === "ready" ? today.session.id : "";
  const blocks = await prisma.studySessionBlock.findMany({ where: { sessionId } });

  return blocks.map((block) => ({ kind: block.kind, payload: readBlockPayload(block) }));
}

describe("practice set in the learner's field", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the field's questions first, then general ones, and never another field's", async () => {
    const { goalId, ids } = await fieldDay({ details: NURSE, due: daysAgo(-10) });
    const blocks = await loadBlocks(goalId);
    const practice = blocks.find((block) => block.kind === "practice");

    expect(practice?.payload.itemIds).toStrictEqual([ids.nursing, ...ids.general]);
  });

  it("keeps a learner without a field on general questions", async () => {
    const { goalId, ids } = await fieldDay({
      details: { level: "none", purpose: "deep" },
      due: daysAgo(-10),
    });

    const blocks = await loadBlocks(goalId);
    const practice = blocks.find((block) => block.kind === "practice");

    expect(practice?.payload.itemIds).toStrictEqual(ids.general);
  });

  it("opens a due capsule with the field's question before the general one", async () => {
    const { goalId, ids } = await fieldDay({ details: NURSE, due: daysAgo(1) });
    const blocks = await loadBlocks(goalId);

    const capsuleItems = blocks.flatMap((block) =>
      block.payload.capsules.flatMap((capsule) => capsule.itemIds),
    );

    expect(capsuleItems).toStrictEqual([ids.nursing, ...ids.general]);
    expect(capsuleItems).not.toContain(ids.law);
  });
});
