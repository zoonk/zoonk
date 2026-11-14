import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { type PlanActions, PlanScreenProvider } from "../../../learn/src/plan/plan-context";
import {
  PlanSuggestionProvider,
  PlanSuggestionSlot,
} from "../../../learn/src/plan/plan-suggestion";
import { type PlanSuggestionHost } from "../../../learn/src/plan/plan-suggestion-context";
import { atViewport } from "../_test-utils/browser-viewport";
import { render } from "../_test-utils/render";

const PHONE = { height: 844, width: 390 };

const FIT_EFFECT = {
  endDateAfter: null,
  endDateBefore: null,
  lessonsAdded: 4,
  lessonsRemoved: 0,
} satisfies PlanChangePreview["effect"];

/** An offer from an earlier day's plan write, so "Add to my plan" checks today's numbers first. */
const PLAN: PlanView = {
  access: { mocksRequirePlus: false },
  areas: [],
  bases: null,
  changes: [],
  course: null,
  currentPhase: null,
  end: null,
  estimate: {
    endDate: null,
    fullCourseEndDate: null,
    pace: null,
    remainingHours: 20,
    totalHours: 30,
  },
  examChoices: [],
  examDocument: "notice",
  feasibility: null,
  fitOffer: {
    canApply: false,
    effect: FIT_EFFECT,
    fits: true,
    operations: [{ kind: "fitLessons" }],
  },
  focusTest: null,
  fundedMocks: [],
  goalId: "01a11014-0000-7000-8000-0000000000f1",
  languageAim: null,
  notice: null,
  numbers: null,
  ownLevel: null,
  phases: [],
  planId: "01a11014-0000-7000-8000-0000000000f2",
  ready: true,
  schedule: {
    dailyMinutes: 30,
    dailyTimes: [],
    fullCourse: false,
    lightWeeks: [],
    mocks: null,
    nextSitting: null,
    noSitting: null,
    noticeDay: null,
    shape: {
      canDiffer: false,
      weekdayDays: [1, 2, 3, 4, 5],
      weekdays: 30,
      weekend: null,
      weekendDays: [],
    },
    studyDays: 5,
    targetDate: "2027-03-01",
    targetDateEstimated: false,
    targetDateNamedMonth: false,
    weekdayMinutes: [0, 30, 30, 30, 30, 30, 0],
  },
  shortPlan: null,
  status: { kind: "onTrack" },
  steering: {
    difficultyBias: "standard",
    lessonsStudied: 0,
    practiceBias: "balanced",
    skippedActivities: [],
  },
  tools: [],
  week: {
    days: [{ date: "2026-11-16", items: [], minutes: 30, mockFunding: null, state: "today" }],
    endDate: "2026-11-22",
    startDate: "2026-11-16",
  },
  weekTime: { studiedMinutes: 0, targetMinutes: 150 },
  writtenPractice: null,
};

const HOST: PlanSuggestionHost = {
  certificates: null,
  courseHref: () => "/course",
  goalStatus: null,
  next: null,
  onAdjust: vi.fn(),
  onEdit: vi.fn(),
};

const TODAY_PREVIEW: PlanChangePreview = {
  effect: FIT_EFFECT,
  feasibility: null,
  finishDate: null,
  ready: true,
  unchanged: false,
};

/** The check for today's numbers waits until the test releases it. */
function renderHeldOffer() {
  const held = Promise.withResolvers<PlanChangePreview | null>();
  const change = vi.fn<PlanActions["change"]>(async () => ({ change: null, status: "applied" }));
  const preview = vi.fn<PlanActions["preview"]>(() => held.promise);

  const actions: PlanActions = {
    adviseOnBases: async () => null,
    change,
    chooseExamOption: async () => null,
    chooseTools: async () => false,
    decide: async () => false,
    findTimeToCover: async () => null,
    preview,
  };

  const screen = render(
    <PlanScreenProvider
      value={{
        actions,
        goal: { displayName: "Learn Spanish", kind: "learn" },
        plan: PLAN,
        shareHref: "/plan",
      }}
    >
      <PlanSuggestionProvider host={HOST}>
        <PlanSuggestionSlot />
      </PlanSuggestionProvider>
    </PlanScreenProvider>,
  );

  return { change, preview, release: () => held.resolve(TODAY_PREVIEW), screen };
}

async function addFromSheet(held: ReturnType<typeof renderHeldOffer>) {
  await page.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Add to my plan" }).click();
  await expect.poll(() => held.preview).toHaveBeenCalledOnce();
}

async function settle() {
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

describe("the Plan's offer to fit more lessons", () => {
  it("adds them once today's check matches the card", async () => {
    await atViewport(PHONE, async () => {
      const held = renderHeldOffer();
      await addFromSheet(held);

      held.release();

      await expect.poll(() => held.change).toHaveBeenCalledWith([{ kind: "fitLessons" }]);
      held.screen.unmount();
    });
  });

  it("changes nothing when the learner closes the sheet before the check answers", async () => {
    await atViewport(PHONE, async () => {
      const held = renderHeldOffer();
      await addFromSheet(held);

      await page.getByRole("button", { name: "Close" }).click();
      held.release();
      await settle();

      expect(held.change).not.toHaveBeenCalled();
      held.screen.unmount();
    });
  });

  it("changes nothing when the learner leaves the Plan before the check answers", async () => {
    await atViewport(PHONE, async () => {
      const held = renderHeldOffer();
      await addFromSheet(held);

      held.screen.unmount();
      held.release();
      await settle();

      expect(held.change).not.toHaveBeenCalled();
    });
  });
});
