import { describe, expect, it } from "vitest";
import { type SessionPlanItem } from "../_utils/session-plan-item";
import { toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { finishChapterCandidate } from "./block-candidates";

function item(lessonId: string, position: number): SessionPlanItem {
  return {
    chapterId: "chapter",
    completedAt: null,
    facts: null,
    id: null,
    key: `lesson:${lessonId}`,
    kind: "lesson",
    lessonId,
    lessons: null,
    minutes: 4,
    phase: 0,
    position,
    scheduledFor: new Date("2026-09-30"),
    skillId: "skill",
    status: "todo",
    titleSnapshot: lessonId,
  };
}

function block(lessonId: string): PlannedBlock {
  return {
    canDo: null,
    estimatedMinutes: 4,
    kind: "learn",
    lessonId,
    payload: toBlockPayload({ chapterId: "chapter", planItemKey: `lesson:${lessonId}` }),
  };
}

describe("chapter missions in a selected unopened day", () => {
  const items = [item("first", 0), item("second", 1)];
  const goalPlan = { items: [], skills: [] };

  it("never mistakes two absent saved IDs for the same planned lesson", () => {
    expect(finishChapterCandidate({ blocks: [block("first")], goalPlan, items })).toBeNull();
  });

  it("anchors all of a chapter's actual logical work when both lessons are selected", () => {
    expect(
      finishChapterCandidate({ blocks: [block("first"), block("second")], goalPlan, items }),
    ).toMatchObject({
      anchor: { chapterId: "chapter", lessonIds: ["first", "second"], planItemIds: [] },
      detail: { count: 2, minutes: 8 },
      kind: "finishChapter",
      total: 2,
    });
  });
});
