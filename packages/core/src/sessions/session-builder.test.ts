import { describe, expect, it } from "vitest";
import { type BlockCapsule, getBlockItemIds, toBlockPayload } from "./block-payload";
import { getPracticeShare } from "./practice-share";
import {
  type PlannedCheckpoint,
  type PlannedLesson,
  type SessionBuildInput,
  buildSessionBlocks,
} from "./session-builder";

function capsule(key: string, questions = 3): BlockCapsule {
  return {
    format: "rapidFire",
    itemIds: Array.from({ length: questions }, (_, index) => `${key}-q${index}`),
    key,
    lessonId: key,
    skillIds: [`${key}-skill`],
    title: key,
  };
}

function lesson(id: string, minutes: number): PlannedLesson {
  return {
    canDo: `You'll do ${id}`,
    chapterId: null,
    lessonId: id,
    minutes,
    planItemId: `plan-${id}`,
    planSkillId: `plan-${id}-skill`,
    skillIds: [`${id}-skill`],
    title: id,
  };
}

const practice = Array.from({ length: 12 }, (_, index) => ({
  itemId: `p${index}`,
  skillId: `s${index % 3}`,
}));

const boss: PlannedCheckpoint = {
  itemIds: Array.from({ length: 10 }, (_, index) => `boss-q${index}`),
  kind: "boss",
  minutes: 15,
  mock: false,
  passMark: 7,
  phase: 1,
  planItemId: "plan-boss",
  rematch: false,
  skillIds: ["s0"],
  timeLimitMinutes: null,
  title: "Phase 2 boss",
};

function getScoring(input: SessionBuildInput) {
  return buildSessionBlocks(input).blocks.map((block) => [block.kind, block.payload.netScored]);
}

const baseInput: SessionBuildInput = {
  capsules: [capsule("a"), capsule("b"), capsule("c")],
  checkpoints: [],
  dailyMinutes: 45,
  drills: [
    {
      itemIds: ["m1", "m2"],
      kind: "retry",
      lessonId: null,
      mistakeId: "mistake-1",
      timeLimitSeconds: null,
    },
  ],
  examTrialEnded: false,
  freshStart: null,
  lessons: [lesson("l1", 14), lesson("l2", 10), lesson("l3", 10)],
  netScored: false,
  placementItemIds: [],
  practice,
  practiceShare: 0.2,
  produce: null,
  reinforcement: [],
  remainingLimitMinutes: null,
  reviewPlanItemId: null,
};

function getFullReview(input: SessionBuildInput) {
  return buildSessionBlocks(input).blocks.find((block) => block.kind === "practice")?.payload;
}

describe(buildSessionBlocks, () => {
  it("builds an easy start, the hard middle and fits the day", () => {
    const { blocks, plannedMinutes } = buildSessionBlocks(baseInput);

    expect(
      blocks.map((block) => [block.kind, block.lessonId, block.estimatedMinutes]),
    ).toStrictEqual([
      ["review", null, 7],
      ["learn", "l1", 14],
      ["learn", "l2", 10],
      ["practice", null, 14],
    ]);

    expect(plannedMinutes).toBe(45);
    expect(blocks[1]?.canDo).toBe("You'll do l1");
    expect(blocks[1]?.payload.planItemId).toBe("plan-l1");

    expect(blocks[3]?.payload.drills).toStrictEqual(baseInput.drills);

    expect(blocks[3]?.payload.itemIds).toStrictEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("opens the first week's sessions with a few placement questions, even without capsules", () => {
    const withCapsules = buildSessionBlocks({ ...baseInput, placementItemIds: ["p1", "p2"] });

    expect(withCapsules.blocks[0]).toMatchObject({
      kind: "review",
      payload: { placementItemIds: ["p1", "p2"] },
    });

    expect(
      getBlockItemIds(withCapsules.blocks[0]?.payload ?? toBlockPayload({})).slice(0, 2),
    ).toStrictEqual(["p1", "p2"]);

    const onlyPlacement = buildSessionBlocks({
      ...baseInput,
      capsules: [],
      placementItemIds: ["p1"],
    });

    expect(onlyPlacement.blocks[0]).toMatchObject({
      kind: "review",
      payload: { capsules: [], placementItemIds: ["p1"] },
    });
  });

  it("makes a welcome back lighter, with fewer reviews", () => {
    const { blocks, plannedMinutes } = buildSessionBlocks({
      ...baseInput,
      freshStart: "welcomeBack",
    });

    expect(blocks[0]?.payload.capsules.map((item) => item.key)).toStrictEqual(["a"]);
    expect(plannedMinutes).toBeLessThanOrEqual(20);
    expect(blocks.some((block) => block.kind === "learn")).toBe(true);
  });

  it("puts reinforcement lessons before a boss rematch and waits on new lessons", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      checkpoints: [boss],
      reinforcement: [lesson("r1", 3), lesson("r2", 3)],
    });

    expect(blocks.map((block) => [block.kind, block.lessonId])).toStrictEqual([
      ["review", null],
      ["learn", "r1"],
      ["learn", "r2"],
      ["practice", null],
      ["checkpoint", null],
    ]);

    expect(blocks[1]?.payload.reinforcement).toBe(true);

    expect(blocks[4]?.payload.checkpoint).toStrictEqual({
      kind: "boss",
      mock: false,
      passMark: 7,
      phase: 1,
      rematch: false,
      timeLimitMinutes: null,
    });
  });

  it("gives the lessons its plan has before a challenge on its day first, and waits on the rest", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      checkpoints: [boss],
      lessons: [{ ...lesson("l1", 5), beforeChallenge: true }, lesson("l2", 10)],
    });

    expect(blocks.map((block) => [block.kind, block.lessonId])).toStrictEqual([
      ["review", null],
      ["learn", "l1"],
      ["practice", null],
      ["checkpoint", null],
    ]);
  });

  it("follows a first duel with the lessons its plan has after it on its day", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      checkpoints: [boss],
      lessons: [
        { ...lesson("l1", 5), beforeChallenge: true },
        { ...lesson("l2", 5), afterChallenge: true },
        lesson("l3", 5),
      ],
    });

    expect(blocks.map((block) => [block.kind, block.lessonId])).toStrictEqual([
      ["review", null],
      ["learn", "l1"],
      ["practice", null],
      ["checkpoint", null],
      ["learn", "l2"],
    ]);
  });

  it("gives the lessons before and after a first duel one budget, in plan order", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      checkpoints: [boss],
      lessons: [
        { ...lesson("l1", 10), beforeChallenge: true },
        { ...lesson("l2", 10), afterChallenge: true },
      ],
    });

    expect(blocks.map((block) => block.lessonId).filter(Boolean)).toStrictEqual(["l1"]);
  });

  it("never holds new lessons back on a rematch, so a lost boss locks nothing", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      checkpoints: [{ ...boss, rematch: true }],
      reinforcement: [lesson("r1", 3), lesson("r2", 3)],
    });

    expect(blocks.map((block) => block.lessonId).filter(Boolean)).toStrictEqual(["r1", "r2", "l1"]);
  });

  it("gives a planned review day to reviews and practice, without new lessons", () => {
    const { blocks } = buildSessionBlocks({ ...baseInput, reviewPlanItemId: "plan-review" });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review", "practice"]);
    expect(blocks[1]?.payload).toMatchObject({ planItemId: "plan-review" });
    expect(blocks[1]?.payload.itemIds).toHaveLength(12);
  });

  it("gives a day whose mock the learner's plan doesn't include to a full review of every skill", () => {
    const pool = Array.from({ length: 30 }, (_, index) => ({
      itemId: `p${index}`,
      skillId: `s${index % 6}`,
    }));

    const skills = ["s0", "s1", "s2", "s3", "s4", "s5"];

    const { blocks, plannedMinutes } = buildSessionBlocks({
      ...baseInput,
      dailyMinutes: 30,
      fullReviewSkillIds: skills,
      practice: pool,
    });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review", "practice"]);
    expect(plannedMinutes).toBeGreaterThanOrEqual(28);

    const review = blocks[1]?.payload;

    expect(review).toMatchObject({ fullReview: true, planItemId: null });
    expect(new Set(review?.skillIds)).toStrictEqual(new Set(skills));
  });

  it("counts the skills the day's quick review asks toward its full review", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      dailyMinutes: 30,
      fullReviewSkillIds: ["s0", "s1", "s2", "a-skill"],
    });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review", "practice"]);
    expect(blocks[1]?.payload.fullReview).toBe(true);
  });

  it("doesn't call a day's practice a full review when it can't ask every skill", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      dailyMinutes: 30,
      fullReviewSkillIds: ["s0", "s1", "s2", "s9"],
    });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review", "practice"]);
    expect(blocks[1]?.payload.fullReview).toBe(false);
  });

  describe("a full review on a day with little time", () => {
    const skills = Array.from({ length: 11 }, (_, index) => `t${index}`);

    const pool = Array.from({ length: 33 }, (_, index) => ({
      itemId: `t-q${index}`,
      skillId: `t${index % 11}`,
    }));

    const fullReviewDay: SessionBuildInput = {
      ...baseInput,
      capsules: [capsule("a")],
      dailyMinutes: 25,
      drills: [],
      fullReviewSkillIds: skills,
      practice: pool,
    };

    it("keeps the day before's full review whole on a welcome back", () => {
      const review = getFullReview({ ...fullReviewDay, freshStart: "welcomeBack" });

      expect(review?.fullReview).toBe(true);
      expect(new Set(review?.skillIds)).toStrictEqual(new Set(skills));
    });

    it("asks every skill once when the day's minutes hold fewer questions", () => {
      const review = getFullReview({ ...fullReviewDay, dailyMinutes: 10 });

      expect(review?.fullReview).toBe(true);
    });

    it("stays within the learner's daily limit", () => {
      const { plannedMinutes } = buildSessionBlocks({
        ...fullReviewDay,
        dailyMinutes: 10,
        remainingLimitMinutes: 10,
      });

      expect(plannedMinutes).toBeLessThanOrEqual(10);
    });
  });

  it("scores mixed practice net for exams where a wrong answer cancels a right one", () => {
    expect(getScoring({ ...baseInput, reviewPlanItemId: "plan-review" })).toStrictEqual([
      ["review", false],
      ["practice", false],
    ]);

    expect(
      getScoring({ ...baseInput, netScored: true, reviewPlanItemId: "plan-review" }),
    ).toStrictEqual([
      ["review", false],
      ["practice", true],
    ]);
  });

  it("keeps reviews and mistake fixes free when a free exam trial has ended", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      checkpoints: [boss],
      examTrialEnded: true,
    });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review", "practice"]);
    expect(blocks[1]?.payload.itemIds).toStrictEqual([]);
    expect(blocks[1]?.payload.drills).toHaveLength(1);
  });

  it("fits the learner's daily limit and builds nothing once it's reached", () => {
    const limited = buildSessionBlocks({ ...baseInput, remainingLimitMinutes: 12 });
    expect(limited.plannedMinutes).toBeLessThanOrEqual(12);

    expect(buildSessionBlocks({ ...baseInput, remainingLimitMinutes: 2 })).toStrictEqual({
      blocks: [],
      plannedMinutes: 0,
    });
  });

  it("still offers the next lesson when it's longer than the day's room", () => {
    const { blocks } = buildSessionBlocks({
      ...baseInput,
      capsules: [],
      dailyMinutes: 10,
      drills: [],
      lessons: [lesson("long", 12)],
    });

    expect(blocks.map((block) => block.lessonId)).toStrictEqual(["long"]);
  });

  it("gives lessons the practice time a day has no questions for, so it doesn't come up short", () => {
    const { blocks, plannedMinutes } = buildSessionBlocks({
      ...baseInput,
      capsules: [],
      dailyMinutes: 30,
      drills: [],
      lessons: Array.from({ length: 10 }, (_, index) => lesson(`l${index}`, 3)),
      practice: [],
      practiceShare: 0.5,
    });

    expect(blocks.every((block) => block.kind === "learn")).toBe(true);
    expect(plannedMinutes).toBe(30);
  });

  it("gives practice the lessons' time on a day with no new lesson left, so it isn't empty", () => {
    const { blocks, plannedMinutes } = buildSessionBlocks({
      ...baseInput,
      capsules: [],
      dailyMinutes: 30,
      drills: [],
      lessons: [],
      practice: Array.from({ length: 30 }, (_, index) => ({
        itemId: `p${index}`,
        skillId: `s${index % 3}`,
      })),
      practiceShare: 0.6,
    });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["practice"]);
    expect(plannedMinutes).toBe(30);
  });

  it("asks a question set whole or leaves it for another day, never cut", () => {
    const passage = Array.from({ length: 4 }, (_, index) => ({
      itemId: `passage-q${index}`,
      setId: "passage",
      skillId: "s0",
    }));

    const withSet = {
      ...baseInput,
      capsules: [],
      drills: [],
      lessons: [],
      practice: [practice[0], ...passage, practice[1], practice[2]].filter(
        (item) => item !== undefined,
      ),
    };

    const getAsked = (minutes: number) =>
      buildSessionBlocks({ ...withSet, remainingLimitMinutes: minutes }).blocks.find(
        (block) => block.kind === "practice",
      )?.payload.itemIds;

    expect(getAsked(6)).toStrictEqual(["p0", "p1", "p2"]);

    expect(getAsked(9)).toStrictEqual(["p0", ...passage.map((item) => item.itemId), "p1"]);
  });
});

describe(getPracticeShare, () => {
  it("keeps practice small during the basics and grows it with the plan", () => {
    expect(getPracticeShare({ daysToExam: null, planProgress: 0.05 })).toBe(0.1);
    expect(getPracticeShare({ daysToExam: null, planProgress: 0.5 })).toBeCloseTo(0.35);
  });

  it("grows most before an exam", () => {
    expect(getPracticeShare({ daysToExam: 20, planProgress: 0.5 })).toBeCloseTo(0.55);
    expect(getPracticeShare({ daysToExam: 5, planProgress: 0.05 })).toBe(0.6);
  });

  it("adds an exam's essay after practice when the day has room, keeping the day's time", () => {
    const { blocks, plannedMinutes } = buildSessionBlocks({
      ...baseInput,
      dailyMinutes: 60,
      produce: {
        itemId: "essay-1",
        minutes: 20,
        skillId: "s-essay",
        title: "Intervention proposal",
      },
    });

    const kinds = blocks.map((block) => block.kind);

    expect(kinds.at(-1)).toBe("produce");
    expect(blocks.at(-1)?.payload.itemIds).toStrictEqual(["essay-1"]);
    expect(plannedMinutes).toBeLessThanOrEqual(60 + 14);
  });
});
