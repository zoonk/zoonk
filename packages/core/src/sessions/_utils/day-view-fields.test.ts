import { type StudyBlockKind } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";
import { type DayOutlines } from "./outlining-stand-ins";
import { EMPTY_WEEK } from "./session-view";

const TODAY = new Date("2026-10-17T00:00:00Z");

function examDay(): DayViewFieldsInput {
  return {
    answers: [],
    current: true,
    dayMinutes: 40,
    examAccess: { includesMockExams: false, trialEnded: false },
    lessonRoom: true,
    missions: [],
    outlines: "awaiting",
    session: {
      blocks: [
        {
          brainPower: 0,
          canDo: null,
          estimatedMinutes: 8,
          kind: "review",
          lessonId: null,
          payload: {},
          position: 0,
          status: "pending",
        },
      ],
      freshStart: "welcomeBack",
      fullMealAt: null,
      goal: null,
      goalId: "goal",
      localDate: TODAY,
      plannedMinutes: 8,
    },
    sessionBar: { completed: 0, total: 1 },
    week: EMPTY_WEEK,
  };
}

function dayOf({
  kinds,
  lessonRoom = true,
  outlines,
}: {
  kinds: StudyBlockKind[];
  lessonRoom?: boolean;
  outlines: DayOutlines;
}) {
  const day = examDay();
  const [block] = day.session.blocks;
  const blocks = kinds.flatMap((kind, position) => (block ? [{ ...block, kind, position }] : []));

  const { emptyDay, lessonsComing, lessonsToPrepare } = toDayViewFields({
    ...day,
    lessonRoom,
    outlines,
    session: { ...day.session, blocks },
  });

  return { emptyDay, lessonsComing, lessonsToPrepare };
}

describe(toDayViewFields, () => {
  it("treats a day with only practice like an empty day: coming while outlined, asked for while idle", () => {
    expect(dayOf({ kinds: [], outlines: "awaiting" }).emptyDay).toBe("lessonsComing");
    expect(dayOf({ kinds: [], outlines: "idle" }).emptyDay).toBe("lessonsToPrepare");

    expect(dayOf({ kinds: ["practice"], outlines: "awaiting" })).toStrictEqual({
      emptyDay: null,
      lessonsComing: true,
      lessonsToPrepare: false,
    });

    expect(dayOf({ kinds: ["practice"], outlines: "idle" })).toStrictEqual({
      emptyDay: null,
      lessonsComing: false,
      lessonsToPrepare: true,
    });
  });

  it("asks a day with lessons for the rest of its time nobody is writing, never one without room", () => {
    expect(dayOf({ kinds: ["learn", "practice"], outlines: "idle" })).toStrictEqual({
      emptyDay: null,
      lessonsComing: false,
      lessonsToPrepare: true,
    });

    expect(dayOf({ kinds: ["learn"], outlines: "awaiting" }).lessonsComing).toBe(true);

    expect(dayOf({ kinds: ["practice"], lessonRoom: false, outlines: "idle" })).toStrictEqual({
      emptyDay: null,
      lessonsComing: false,
      lessonsToPrepare: false,
    });
  });
});
