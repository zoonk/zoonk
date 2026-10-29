import { type StudyBlockKind } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";
import { type DayOutlines } from "./outlining-stand-ins";

const TODAY = new Date("2026-10-17T00:00:00Z");

function examDay({ trialEnded }: { trialEnded: boolean }): DayViewFieldsInput {
  return {
    answers: [],
    current: true,
    dailyLimit: null,
    dayMinutes: 40,
    examAccess: { includesMockExams: !trialEnded, trialEnded },
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
    week: { days: [], nextStudyDate: null, time: { studiedMinutes: 0, targetMinutes: 0 } },
  };
}

function emptyExamDay({ trialEnded }: { trialEnded: boolean }): DayViewFieldsInput {
  const day = examDay({ trialEnded });
  return { ...day, session: { ...day.session, blocks: [] } };
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
  const day = examDay({ trialEnded: false });
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
  it("promises no lessons to come on a free exam plan past its first week", () => {
    expect(toDayViewFields(examDay({ trialEnded: true })).lessonsComing).toBe(false);
    expect(toDayViewFields(examDay({ trialEnded: false })).lessonsComing).toBe(true);
  });

  it("says an empty day on a free exam plan past its first week has nothing new, never lessons on the way", () => {
    expect(toDayViewFields(emptyExamDay({ trialEnded: true })).emptyDay).toBe("nothingNew");
    expect(toDayViewFields(emptyExamDay({ trialEnded: false })).emptyDay).toBe("lessonsComing");
  });

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

  it("never asks a day with a lesson of its own, or one without room, for lessons nobody is writing", () => {
    expect(dayOf({ kinds: ["learn", "practice"], outlines: "idle" }).lessonsToPrepare).toBe(false);
    expect(dayOf({ kinds: ["learn"], outlines: "awaiting" }).lessonsComing).toBe(true);

    expect(dayOf({ kinds: ["practice"], lessonRoom: false, outlines: "idle" })).toStrictEqual({
      emptyDay: null,
      lessonsComing: false,
      lessonsToPrepare: false,
    });
  });
});
