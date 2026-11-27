import { describe, expect, it } from "vitest";
import { type BlockCapsule, toBlockPayload } from "../block-payload";
import {
  type PlannedBlock,
  type PlannedLesson,
  type SessionBuildInput,
  buildSessionBlocks,
} from "../session-builder";
import { buildRemainingDay } from "./rebuild-day-input";

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

const baseInput: SessionBuildInput = {
  capsules: [capsule("a"), capsule("b"), capsule("c")],
  checkpoints: [],
  dailyMinutes: 45,
  freshStart: null,
  lessons: [lesson("l1", 14), lesson("l2", 10), lesson("l3", 10)],
  netScored: false,
  placementItemIds: [],
  practice: Array.from({ length: 12 }, (_, index) => ({
    itemId: `p${index}`,
    skillId: `s${index % 3}`,
  })),
  practiceShare: 0.2,
  produces: [],
  reviewPlanItemId: null,
  topics: new Map([
    ["s0", { area: "Math", name: "Functions" }],
    ["s1", { area: "Math", name: "Percentages" }],
    ["s2", { area: "Science", name: "Ecology" }],
  ]),
};

const teaching = (lessonId: string, minutes: number): PlannedBlock => ({
  canDo: null,
  estimatedMinutes: minutes,
  kind: "learn",
  lessonId,
  payload: toBlockPayload({ returning: "again", skillIds: ["s0"], title: lessonId }),
});

const isRemedial = (block: PlannedBlock) =>
  block.payload.mistakeIds.length > 0 ||
  block.payload.patternId !== null ||
  block.payload.returning !== null;

const newLessons = (blocks: readonly PlannedBlock[]) =>
  blocks
    .filter((block) => block.kind === "learn" && !isRemedial(block))
    .map((block) => block.lessonId);

describe("a saved day with remedial blocks, rebuilt after a plan change (followPlanChangeToday)", () => {
  it("keeps a displaced sole lesson out of the saved day's refill", () => {
    const input = {
      ...baseInput,
      capsules: [],
      dailyMinutes: 10,
      lessons: [lesson("only-new", 8)],
      practice: [],
    };

    const opened = buildSessionBlocks({
      ...input,
      remedial: { dated: false, mistakes: [], teaching: [teaching("old", 4)] },
    });

    const kept = opened.blocks.map((block) => ({
      ...block,
      id: "kept",
      status: "active" as const,
    }));

    expect(kept).toMatchObject([{ payload: { replacedOnlyLesson: true } }]);

    const rebuilt = buildRemainingDay({
      dated: false,
      input: { ...input, dailyMinutes: 15 },
      kept,
      session: { blocks: kept, plannedMinutes: opened.plannedMinutes },
    });

    expect(rebuilt.blocks).toStrictEqual([]);
  });

  it.each(["pending", "active"] as const)("keeps new lessons with %s remedial blocks", (status) => {
    const remedial = {
      dated: true,
      mistakes: [
        { id: "first", minutes: 0.75, skillId: "s0" },
        { id: "same-skill", minutes: 0.75, skillId: "s0" },
        { id: "other-skill", minutes: 2, skillId: "s1" },
      ],
      teaching: [teaching("old", 5)],
    };

    const withoutRemedial = buildSessionBlocks(baseInput);
    const opened = buildSessionBlocks({ ...baseInput, remedial });

    expect(newLessons(opened.blocks)).toStrictEqual(newLessons(withoutRemedial.blocks));

    const blocks = opened.blocks.map((block, index) => ({
      ...block,
      id: String(index),
      status: isRemedial(block) ? status : ("pending" as const),
    }));

    const rebuilt = buildRemainingDay({
      dated: true,
      input: baseInput,
      kept: blocks.filter((block) => isRemedial(block)),
      session: { blocks, plannedMinutes: opened.plannedMinutes },
    });

    expect(newLessons(rebuilt.blocks)).toStrictEqual(newLessons(opened.blocks));
    expect(rebuilt.blocks.filter((block) => isRemedial(block))).toStrictEqual([]);
  });
});

const essayBlocks = (blocks: readonly PlannedBlock[]) =>
  blocks.filter((block) => block.kind === "produce");

describe("an open day refreshed with a whole answer due (buildRemainingDay)", () => {
  const essay = { minutes: 45, taskKey: "essay", title: "Essay", unit: "answer" as const };
  const input = { ...baseInput, capsules: [], lessons: [], practice: [], produces: [essay] };

  const keptDay = (minutes: number) => {
    const kept = [
      {
        ...teaching("shown", minutes),
        id: "shown",
        payload: toBlockPayload({ title: "shown" }),
        status: "pending" as const,
      },
    ];

    return buildRemainingDay({
      dated: true,
      input,
      kept,
      session: { blocks: kept, plannedMinutes: minutes },
    });
  };

  it("adds no answer past the day's time left", () => {
    expect(keptDay(40)).toStrictEqual({ blocks: [], plannedMinutes: 40 });
  });

  it("adds an answer that fits the time left", () => {
    expect(
      essayBlocks(
        buildRemainingDay({
          dated: true,
          input: { ...input, dailyMinutes: 90 },
          kept: [],
          session: { blocks: [], plannedMinutes: 0 },
        }).blocks,
      ),
    ).toMatchObject([{ estimatedMinutes: 45, kind: "produce" }]);

    expect(essayBlocks(keptDay(0).blocks)).toMatchObject([
      { estimatedMinutes: 45, kind: "produce" },
    ]);
  });
});
