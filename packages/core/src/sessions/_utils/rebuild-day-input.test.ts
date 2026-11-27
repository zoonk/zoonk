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
