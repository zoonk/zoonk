import { describe, expect, it } from "vitest";
import { type TodayHostNoticeState, pickTodayNotice } from "./today-notice-order";

type PickInput = Parameters<typeof pickTodayNotice>[0];
type Today = PickInput["today"];

const NO_HOST: TodayHostNoticeState = {
  practice: false,
  sourceChange: false,
  uploadRequest: false,
};

function today(overrides: Partial<Today> = {}): Today {
  return {
    exam: null,
    guardianInvite: false,
    insight: null,
    planChange: null,
    session: {
      blocks: [{ status: "pending" }],
      examAccess: { trialEnded: false },
      freshStart: null,
    },
    studiedToday: false,
    suggestedGoal: null,
    ...overrides,
  };
}

function pick({
  host = {},
  view = {},
}: {
  host?: Partial<TodayHostNoticeState>;
  view?: Partial<Today>;
}) {
  return pickTodayNotice({ host: { ...NO_HOST, ...host }, today: today(view) });
}

const welcomeBack = (overrides: Partial<Today["session"]> = {}): Today["session"] => ({
  blocks: [{ status: "pending" }],
  examAccess: { trialEnded: false },
  freshStart: "welcomeBack",
  ...overrides,
});

const insightChange = (status: "applied" | "proposed"): Today["insight"] => ({
  kind: "planChange",
  planChange: { effect: null, id: "insight-change", status },
});

const planChange = (status: "applied" | "proposed", id = "change"): Today["planChange"] => ({
  behind: null,
  id,
  status,
});

/** Falling behind put the goal's date at risk: the learner chooses what to do. */
const fallingBehind: Today["planChange"] = {
  behind: {
    canFocus: true,
    coveredAfter: 0.9,
    coveredBefore: 1,
    currentMinutes: 45,
    dailyMinutes: 60,
    fullDepth: true,
    measure: "exam",
  },
  id: "behind",
  status: "applied",
};

describe(pickTodayNotice, () => {
  it("shows nothing on an ordinary day", () => {
    expect(pick({})).toBeNull();
  });

  it("puts a plan change waiting for an OK before a changed exam notice and a welcome back", () => {
    expect(
      pick({
        host: { sourceChange: true },
        view: { planChange: planChange("proposed"), session: welcomeBack() },
      }),
    ).toBe("planChange");

    expect(
      pick({ host: { sourceChange: true }, view: { insight: insightChange("proposed") } }),
    ).toBe("insight");

    expect(pick({ host: { sourceChange: true }, view: { session: welcomeBack() } })).toBe(
      "sourceChange",
    );

    expect(pick({ host: { sourceChange: true }, view: { planChange: fallingBehind } })).toBe(
      "planChange",
    );
  });

  it("puts the exam's own days first, and its final stretch after a changed notice", () => {
    expect(
      pick({
        view: {
          exam: { resultReported: false, stage: "examDay" },
          planChange: planChange("proposed"),
        },
      }),
    ).toBe("exam");

    expect(
      pick({
        host: { sourceChange: true },
        view: { exam: { resultReported: false, stage: "finalStretch" } },
      }),
    ).toBe("sourceChange");

    expect(pick({ view: { exam: { resultReported: false, stage: "finalStretch" } } })).toBe("exam");
  });

  it("asks how the exam went only until the result is in", () => {
    expect(pick({ view: { exam: { resultReported: false, stage: "afterExam" } } })).toBe("exam");
    expect(pick({ view: { exam: { resultReported: true, stage: "afterExam" } } })).toBeNull();
  });

  it("keeps a change already made, a tip and a language's practice below the exam plan's end", () => {
    const trialEnded = welcomeBack({ examAccess: { trialEnded: true }, freshStart: null });

    expect(
      pick({
        host: { practice: true },
        view: { planChange: planChange("applied"), session: trialEnded },
      }),
    ).toBe("examAccess");

    expect(pick({ host: { practice: true }, view: { planChange: planChange("applied") } })).toBe(
      "planChange",
    );

    expect(pick({ host: { practice: true }, view: { insight: insightChange("applied") } })).toBe(
      "insight",
    );

    expect(pick({ host: { practice: true }, view: { session: welcomeBack() } })).toBe("practice");
  });

  it("lets an insight say a plan change it explains, so the change never shows twice", () => {
    const explained = {
      insight: insightChange("proposed"),
      planChange: planChange("proposed", "insight-change"),
    };

    expect(pick({ view: explained })).toBe("insight");

    // Another proposal still comes first, and the insight waits for the next visit.
    expect(pick({ view: { ...explained, planChange: planChange("proposed") } })).toBe("planChange");
  });

  it("drops the welcome back once the learner has started the day", () => {
    expect(pick({ view: { session: welcomeBack() } })).toBe("freshStart");
    expect(pick({ view: { session: welcomeBack(), studiedToday: true } })).toBeNull();

    expect(
      pick({
        view: {
          session: welcomeBack({ blocks: [{ status: "completed" }, { status: "pending" }] }),
        },
      }),
    ).toBeNull();
  });

  it("offers a course from before goals only when nothing else needs saying", () => {
    const suggestedGoal = { id: "suggestion", status: "pending" as const, title: "Physics" };

    expect(pick({ view: { suggestedGoal } })).toBe("suggestedGoal");
    expect(pick({ view: { session: welcomeBack(), suggestedGoal } })).toBe("freshStart");
  });

  it("asks a teen who just signed up from a guest session to invite a guardian, after the plan's asks", () => {
    expect(pick({ view: { guardianInvite: true } })).toBe("guardianInvite");

    expect(pick({ host: { uploadRequest: true }, view: { guardianInvite: true } })).toBe(
      "uploadRequest",
    );

    expect(pick({ view: { guardianInvite: true, session: welcomeBack() } })).toBe("guardianInvite");
  });
});
