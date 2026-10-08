import { type LearnerSkill } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type SkillReview, getAnswerEvents } from "./answer-events";

const TIME_ZONE = "America/Sao_Paulo";

function skill(memory: Partial<LearnerSkill>): LearnerSkill {
  return {
    createdAt: new Date("2026-09-01T12:00:00Z"),
    difficulty: 5,
    due: null,
    id: "learner-skill",
    lapses: 0,
    lastReviewedAt: null,
    recallDays: 0,
    reps: 0,
    skillId: "skill",
    stability: 0,
    state: "new",
    updatedAt: new Date("2026-09-01T12:00:00Z"),
    userId: "user",
    ...memory,
  };
}

/** A skill studied on September 1st (São Paulo), due on the 4th, answered again. */
function reviewed(after: Partial<LearnerSkill> = {}): SkillReview {
  const before = skill({
    due: new Date("2026-09-04T03:00:00Z"),
    lastReviewedAt: new Date("2026-09-01T15:00:00Z"),
    reps: 1,
    state: "learning",
  });

  return { after: { ...before, reps: 2, ...after }, before };
}

function events(answeredAt: string, review: SkillReview | null, isCorrect = true) {
  return getAnswerEvents({
    answeredAt: new Date(answeredAt),
    fixedMistakes: [],
    isCorrect,
    review,
    timeZone: TIME_ZONE,
  });
}

describe(getAnswerEvents, () => {
  it("counts a review on a later local day, early or late against the due day", () => {
    expect(events("2026-09-03T15:00:00Z", reviewed(), false)).toStrictEqual([
      {
        name: "Review Completed",
        properties: {
          days_after_due: -1,
          days_since_last_review: 2,
          is_correct: false,
          skill_id: "skill",
        },
      },
    ]);

    expect(events("2026-09-10T15:00:00Z", reviewed())).toMatchObject([
      { properties: { days_after_due: 6, days_since_last_review: 9 } },
    ]);
  });

  it("doesn't count answers on the day a skill was studied, even past UTC midnight", () => {
    // 23:30 on September 1st in São Paulo is already the 2nd in UTC.
    expect(events("2026-09-02T02:30:00Z", reviewed())).toStrictEqual([]);

    expect(
      events("2026-09-03T15:00:00Z", { after: skill({ reps: 1 }), before: skill({}) }),
    ).toStrictEqual([]);
  });

  it("reports a mastery state change and each mistake the answer fixed", () => {
    const review = { after: skill({ reps: 1, state: "learning" }), before: skill({}) };

    expect(
      getAnswerEvents({
        answeredAt: new Date("2026-09-01T15:00:00Z"),
        fixedMistakes: [
          { cause: "gap", skillId: "skill" },
          { cause: null, skillId: null },
        ],
        isCorrect: true,
        review,
        timeZone: TIME_ZONE,
      }),
    ).toStrictEqual([
      {
        name: "Skill Level Changed",
        properties: { from_state: "new", skill_id: "skill", to_state: "learning" },
      },
      { name: "Mistake Fixed", properties: { cause: "gap", skill_id: "skill" } },
      { name: "Mistake Fixed", properties: { cause: null, skill_id: null } },
    ]);
  });
});
