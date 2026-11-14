import { describe, expect, it } from "vitest";
import { type TodayHostNoticeState, pickTodayNotice } from "./today-notice";

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
    examChoice: null,
    focusTest: null,
    insight: null,
    planChange: null,
    session: { blocks: [{ status: "pending" }], freshStart: null },
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
  freshStart: "welcomeBack",
  ...overrides,
});

const insightChange = (status: "applied" | "proposed"): Today["insight"] => ({
  kind: "planChange",
  planChange: {
    canApply: status === "proposed",
    effect: null,
    id: "insight-change",
    quote: null,
    status,
  },
});

const planChange = (status: "applied" | "proposed", id = "change"): Today["planChange"] => ({
  behind: null,
  id,
  status,
});

const fallingBehind: Today["planChange"] = {
  behind: {
    canFocus: true,
    coveredAfter: 0.9,
    coveredBefore: 1,
    currentMinutes: 45,
    measure: "exam",
  },
  id: "behind",
  status: "applied",
};

describe(pickTodayNotice, () => {
  it("shows nothing on an ordinary day", () => {
    expect(pick({})).toBeNull();
  });

  it("puts a plan change waiting for an OK before a changed exam notice", () => {
    expect(
      pick({ host: { sourceChange: true }, view: { planChange: planChange("proposed") } }),
    ).toBe("planChange");

    expect(
      pick({ host: { sourceChange: true }, view: { insight: insightChange("proposed") } }),
    ).toBe("insight");

    expect(pick({ host: { sourceChange: true } })).toBe("sourceChange");

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

  it("keeps a change already made, a tip and a language's practice in their priority order", () => {
    const ordinarySession = welcomeBack({ freshStart: null });

    expect(
      pick({
        host: { practice: true },
        view: { planChange: planChange("applied"), session: ordinarySession },
      }),
    ).toBe("planChange");

    expect(pick({ host: { practice: true }, view: { planChange: planChange("applied") } })).toBe(
      "planChange",
    );

    expect(pick({ host: { practice: true }, view: { insight: insightChange("applied") } })).toBe(
      "insight",
    );

    expect(pick({ host: { practice: true } })).toBe("practice");
  });

  it("lets an insight say a plan change it explains, so the change never shows twice", () => {
    const explained = {
      insight: insightChange("proposed"),
      planChange: planChange("proposed", "insight-change"),
    };

    expect(pick({ view: explained })).toBe("insight");

    expect(pick({ view: { ...explained, planChange: planChange("proposed") } })).toBe("planChange");
  });

  it("holds everything but the exam's own days while the day welcomes the learner back", () => {
    const waiting = {
      examChoice: { group: "Língua Estrangeira" },
      insight: insightChange("proposed"),
      planChange: fallingBehind,
    };

    const host = { practice: true, sourceChange: true, uploadRequest: true };

    expect(pick({ host, view: { ...waiting, session: welcomeBack() } })).toBeNull();

    expect(
      pick({
        host,
        view: {
          ...waiting,
          exam: { resultReported: false, stage: "finalStretch" },
          session: welcomeBack(),
        },
      }),
    ).toBeNull();

    expect(
      pick({
        host,
        view: {
          ...waiting,
          exam: { resultReported: false, stage: "dayBefore" },
          session: welcomeBack(),
        },
      }),
    ).toBe("exam");
  });

  it("shows what waited once the learner starts or has studied today", () => {
    const started = welcomeBack({ blocks: [{ status: "completed" }, { status: "pending" }] });

    expect(pick({ view: { planChange: planChange("proposed"), session: started } })).toBe(
      "planChange",
    );

    expect(
      pick({
        view: { planChange: planChange("proposed"), session: welcomeBack(), studiedToday: true },
      }),
    ).toBe("planChange");
  });

  it("asks for an exam choice left for later after what waits for an OK, before a change already made", () => {
    const examChoice = { group: "Língua Estrangeira" };

    expect(pick({ view: { examChoice } })).toBe("examChoice");
    expect(pick({ view: { examChoice, planChange: planChange("proposed") } })).toBe("planChange");
    expect(pick({ host: { uploadRequest: true }, view: { examChoice } })).toBe("uploadRequest");
    expect(pick({ view: { examChoice, planChange: planChange("applied") } })).toBe("examChoice");
  });

  it("offers a course from before goals only when nothing else needs saying", () => {
    const suggestedGoal = {
      courseId: null,
      id: "suggestion",
      status: "pending" as const,
      title: "Physics",
    };

    expect(pick({ view: { suggestedGoal } })).toBe("suggestedGoal");

    expect(pick({ view: { session: welcomeBack(), suggestedGoal } })).toBeNull();

    expect(
      pick({
        view: {
          session: welcomeBack({ blocks: [{ status: "completed" }, { status: "pending" }] }),
          suggestedGoal,
        },
      }),
    ).toBe("suggestedGoal");

    expect(pick({ view: { session: welcomeBack(), studiedToday: true, suggestedGoal } })).toBe(
      "suggestedGoal",
    );
  });
});
