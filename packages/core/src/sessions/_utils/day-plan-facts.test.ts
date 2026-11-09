import { describe, expect, it } from "vitest";
import { toBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";
import { getDayFreshStart } from "./day-plan-facts";
import { type SessionPlanItem } from "./session-plan-item";

const today = new Date("2026-11-10");

const items = [
  { id: "old-lesson", kind: "lesson", phase: 0, position: 0, status: "done" },
  { id: "boss", kind: "boss", phase: 0, position: 1, status: "todo" },
  { id: "new-lesson", kind: "lesson", phase: 1, position: 2, status: "todo" },
] as SessionPlanItem[];

const plan = { isFirstDay: false, items, lastStudyDate: new Date("2026-11-09"), planStart: today };

function block(id: string, kind: PlannedBlock["kind"]): PlannedBlock {
  return {
    canDo: null,
    estimatedMinutes: 15,
    kind,
    lessonId: null,
    payload: toBlockPayload({ planItemId: id }),
  };
}

describe(getDayFreshStart, () => {
  it.each([{ after: [] }, { after: [block("new-lesson", "learn")] }])(
    "does not announce a new phase after an old challenge",
    ({ after }) => {
      expect(
        getDayFreshStart({ blocks: [block("boss", "checkpoint"), ...after], plan, today }),
      ).toBeNull();
    },
  );

  it("announces a new phase when today's first teaching starts it", () => {
    expect(getDayFreshStart({ blocks: [block("new-lesson", "learn")], plan, today })).toBe(
      "newPhase",
    );
  });
});
