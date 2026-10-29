import { type StudySessionSummaryResult } from "@zoonk/core/sessions/summary";
import { getBeltStartBrainPower } from "@zoonk/utils/belt-level";
import { describe, expect, it } from "vitest";
import { serializeStudySessionSummary } from "./study-session-serializers";

type StudySessionSummary = Extract<StudySessionSummaryResult, { status: "ready" }>["summary"];

const SUMMARY: StudySessionSummary = {
  accuracy: null,
  belt: null,
  bestStreak: 0,
  brainPower: 0,
  buddyAte: { fixes: 0, newIdeas: 0, reviews: 0 },
  capsulesSealed: [],
  ceremony: {
    earnedAt: new Date("2026-10-29T12:00:00.000Z"),
    id: "01a12345-0000-7000-8000-000000000001",
    key: "yellow",
    kind: "belt",
    shownAt: null,
    userId: "01a12345-0000-7000-8000-000000000002",
  },
  comesBack: [],
  correct: 0,
  energy: null,
  extraTime: { available: false, lessons: [], minutes: 0, reason: null },
  finished: true,
  fullMeal: false,
  minutes: 0,
  missions: [],
  mistakesSaved: 0,
  netScore: null,
  newCards: [],
  preparation: { after: null, before: null },
  progress: { after: null, before: null },
  questions: 0,
  sessionId: "01a12345-0000-7000-8000-000000000003",
  skillsMoved: [],
  status: "completed",
  tomorrow: null,
  topHyperdrive: 0,
};

describe(serializeStudySessionSummary, () => {
  it("sends the ceremony as the milestone the apps show, with the belt's Brain Power and without the learner's id", () => {
    expect(serializeStudySessionSummary(SUMMARY).ceremony).toStrictEqual({
      beltStartBrainPower: getBeltStartBrainPower("yellow"),
      earnedAt: "2026-10-29T12:00:00.000Z",
      id: "01a12345-0000-7000-8000-000000000001",
      key: "yellow",
      kind: "belt",
      shownAt: null,
    });
  });
});
