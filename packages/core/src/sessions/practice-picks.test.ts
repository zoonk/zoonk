import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getPracticePicks } from "../library/exams/practice-picks";
import { loadPracticeItems } from "./_utils/load-practice";
import { getReviewHorizon, loadReviewCapsules } from "./_utils/load-review-capsules";

const NOW = new Date("2026-11-28T12:00:00Z");
const citation = { passage: "…", sourceId: "notice" };
const LEARN_GOAL = { details: null, kind: "learn" as const };

async function bankFixture() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const [onePick, selectAll, chooseTwo] = await Promise.all([
    itemFixture({ skillId: skill.id }),
    itemFixture({ content: { ...choiceItemContent(), select: "all" }, skillId: skill.id }),
    itemFixture({ content: { ...choiceItemContent(), select: 2 }, skillId: skill.id }),
  ]);

  return { chooseTwo, onePick, selectAll, skill, user };
}

function loadPractice({
  picks,
  skillId,
  userId,
}: {
  picks: ReturnType<typeof getPracticePicks>;
  skillId: string;
  userId: string;
}) {
  return loadPracticeItems({
    difficultyBias: "standard",
    examBlueprintId: null,
    excludeItemIds: new Set(),
    field: null,
    includeUnstudied: true,
    maxMinutes: 30,
    now: NOW,
    picks,
    skillIds: [skillId],
    typed: false,
    userId,
  });
}

describe("practice picks", () => {
  it("never asks a learner to pick several options outside an exam that asks it", async () => {
    const { onePick, skill, user } = await bankFixture();

    const practice = await loadPractice({
      picks: getPracticePicks({ goal: LEARN_GOAL, structure: null }),
      skillId: skill.id,
      userId: user.id,
    });

    expect(practice.map((item) => item.itemId)).toStrictEqual([onePick.id]);
  });

  it("practices an exam's own select-all questions, but not a pick count it never asks", async () => {
    const { onePick, selectAll, skill, user } = await bankFixture();

    const structure = {
      formats: [
        { citation, description: "One correct", kind: "multipleChoice" as const, options: 4 },
        {
          citation,
          description: "Select all that apply",
          kind: "multipleChoice" as const,
          options: 6,
          select: "all" as const,
        },
      ],
      pastOptions: null,
    };

    const practice = await loadPractice({
      picks: getPracticePicks({ goal: { details: null, kind: "exam" }, structure }),
      skillId: skill.id,
      userId: user.id,
    });

    expect(new Set(practice.map((item) => item.itemId))).toStrictEqual(
      new Set([onePick.id, selectAll.id]),
    );
  });

  it("leaves out a whole passage when one of its questions asks for several picks", async () => {
    const [user, skill, set] = await Promise.all([userFixture(), skillFixture(), itemSetFixture()]);

    const [onePick] = await Promise.all([
      itemFixture({ skillId: skill.id }),
      itemFixture({ setId: set.id, setPosition: 0, skillId: skill.id }),
      itemFixture({
        content: { ...choiceItemContent(), select: 2 },
        setId: set.id,
        setPosition: 1,
        skillId: skill.id,
      }),
    ]);

    const practice = await loadPractice({
      picks: getPracticePicks({ goal: LEARN_GOAL, structure: null }),
      skillId: skill.id,
      userId: user.id,
    });

    expect(practice.map((item) => item.itemId)).toStrictEqual([onePick.id]);
  });

  it("keeps several-pick questions out of a review", async () => {
    const { onePick, skill, user } = await bankFixture();

    await learnerSkillFixture({
      lastReviewedAt: new Date("2026-11-20T12:00:00Z"),
      reps: 2,
      skillId: skill.id,
      userId: user.id,
    });

    const capsules = await loadReviewCapsules({
      dailyMinutes: 20,
      examBlueprintId: null,
      field: null,
      horizon: getReviewHorizon({
        finalStretchStart: null,
        goal: { kind: "learn", targetDate: null },
        localDate: NOW,
        timeZone: "UTC",
      }),
      netScoring: false,
      picks: getPracticePicks({ goal: LEARN_GOAL, structure: null }),
      planLessons: [],
      skillIds: [skill.id],
      userId: user.id,
      weakest: true,
    });

    expect(capsules.flatMap((capsule) => capsule.itemIds)).toStrictEqual([onePick.id]);
  });
});
