import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanBasesView, type PlanView } from "@zoonk/core/plans/view-contract";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { PlanBasesSheet, useBasesSheet } from "../../../learn/src/plan/plan-bases-sheet";
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

const BASES: PlanBasesView = {
  daysLeft: null,
  items: [
    {
      area: "Algebra",
      choice: "quick",
      choices: ["deep", "essential", "quick", "skip"],
      minutes: { deep: 120, essential: 40, quick: 10 },
      name: "Fractions",
      neededFor: ["Equations"],
      skillId: "fractions",
      studied: false,
    },
  ],
  knownCount: 0,
};

/** Its fit offer is from an earlier day's plan write, so "Add to my plan" checks today's numbers first. */
const PLAN: PlanView = {
  access: { mocksRequirePlus: false },
  areas: [],
  bases: BASES,
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

/** The Plan's answers wait until the test releases them. */
function renderPlan(
  children: React.ReactNode,
  { adviseOnBases = async () => null }: { adviseOnBases?: PlanActions["adviseOnBases"] } = {},
) {
  const heldChange = Promise.withResolvers<Awaited<ReturnType<PlanActions["change"]>>>();
  const change = vi.fn<PlanActions["change"]>(() => heldChange.promise);
  const previewAnswers: PromiseWithResolvers<PlanChangePreview | null>[] = [];

  const preview = vi.fn<PlanActions["preview"]>(() => {
    const answer = Promise.withResolvers<PlanChangePreview | null>();
    previewAnswers.push(answer);
    return answer.promise;
  });

  const actions: PlanActions = {
    adviseOnBases,
    change,
    chooseExamOption: async () => null,
    chooseTools: async () => false,
    decide: async () => false,
    findTimeToCover: async () => null,
    preview,
  };

  const screenFor = (plan: PlanView) => (
    <PlanScreenProvider
      value={{
        actions,
        goal: { displayName: "Learn Spanish", kind: "learn" },
        plan,
        shareHref: "/plan",
      }}
    >
      {children}
    </PlanScreenProvider>
  );

  const screen = render(screenFor(PLAN));

  return {
    change,
    preview,
    releaseChange: () => heldChange.resolve({ change: null, status: "applied" }),
    /** Answers the oldest check still waiting; `null` is a check that failed. */
    releasePreview: (answer: PlanChangePreview | null = TODAY_PREVIEW) =>
      previewAnswers.shift()?.resolve(answer),
    screen,
    /** The page read again, such as on the next day. */
    showPlan: (plan: PlanView) => screen.rerender(screenFor(plan)),
  };
}

function renderHeldOffer() {
  const held = renderPlan(
    <PlanSuggestionProvider host={HOST}>
      <PlanSuggestionSlot />
    </PlanSuggestionProvider>,
  );

  return { ...held, release: held.releasePreview };
}

async function addFromSheet(held: ReturnType<typeof renderHeldOffer>) {
  await page.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Add to my plan" }).click();
  await expect.poll(() => held.preview).toHaveBeenCalledOnce();
}

async function tryAgain() {
  const button = page.getByRole("dialog").getByRole("button", { name: "Try again" });
  await expect.element(button).toBeVisible();
  await button.click();
}

function BasesSheetHost() {
  const { open, setOpen, show } = useBasesSheet();

  return (
    <>
      <button onClick={show} type="button">
        Open prerequisites
      </button>
      <output>{open ? "Sheet open" : "Sheet closed"}</output>
      <PlanBasesSheet bases={BASES} onOpenChange={setOpen} open={open} />
    </>
  );
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
      expect(page.getByText("The numbers are different today.").query()).toBeNull();
      held.releaseChange();
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

describe("the fit offer's Try again after a failed check", () => {
  it("adds the lessons when today's numbers match the card", async () => {
    await atViewport(PHONE, async () => {
      const held = renderHeldOffer();
      await addFromSheet(held);
      held.releasePreview(null);

      await tryAgain();
      await expect.poll(() => held.preview).toHaveBeenCalledTimes(2);
      held.releasePreview();

      await expect.poll(() => held.change).toHaveBeenCalledOnce();
      expect(page.getByText("The numbers are different today.").query()).toBeNull();
      held.releaseChange();
      await settle();

      expect(held.change).toHaveBeenCalledOnce();
      held.screen.unmount();
    });
  });

  it("shows today's numbers to confirm when they differ from the card", async () => {
    await atViewport(PHONE, async () => {
      const held = renderHeldOffer();
      await addFromSheet(held);
      held.releasePreview(null);

      await tryAgain();
      await expect.poll(() => held.preview).toHaveBeenCalledTimes(2);
      held.releasePreview({ ...TODAY_PREVIEW, effect: { ...FIT_EFFECT, lessonsAdded: 2 } });

      const sheet = page.getByRole("dialog");
      await expect.element(sheet.getByText("The numbers are different today.")).toBeVisible();
      await expect.element(sheet.getByRole("button", { name: "Change my plan" })).toBeVisible();
      expect(held.change).not.toHaveBeenCalled();
      held.screen.unmount();
    });
  });
});

describe("the Plan's prerequisites sheet", () => {
  it("stays open when a save the learner closed answers after they open it again", async () => {
    await atViewport(PHONE, async () => {
      const held = renderPlan(<BasesSheetHost />);

      await page.getByRole("button", { name: "Open prerequisites" }).click();
      await page.getByText("Every lesson").click();
      await expect.poll(() => held.preview).toHaveBeenCalledOnce();
      held.releasePreview();
      await page.getByRole("button", { name: "Save" }).click();
      await expect.poll(() => held.change).toHaveBeenCalledOnce();

      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "Open prerequisites" }).click();
      await expect.element(page.getByText("Sheet open")).toBeInTheDocument();
      held.releaseChange();
      await settle();

      expect(page.getByText("Sheet closed").query()).toBeNull();
      held.screen.unmount();
    });
  });
});

const NEXT_DAY_PLAN: PlanView = {
  ...PLAN,
  week: {
    ...PLAN.week,
    days: [{ date: "2026-11-17", items: [], minutes: 30, mockFunding: null, state: "today" }],
  },
};

function recommended(label: string) {
  return page.getByRole("radio", { name: new RegExp(`${label}.*Recommended`, "u") });
}

async function reopenBases() {
  await page.getByRole("button", { name: "Close" }).click();
  await expect.element(page.getByText("Sheet closed")).toBeInTheDocument();
  await page.getByRole("button", { name: "Open prerequisites" }).click();
}

describe("the prerequisites recommendation", () => {
  it("asks again on the first opening of a new day, when its answer can change", async () => {
    await atViewport(PHONE, async () => {
      const adviseOnBases = vi
        .fn<PlanActions["adviseOnBases"]>()
        .mockResolvedValueOnce({ daysLeft: 61, ready: true, recommended: "essential" })
        .mockResolvedValueOnce({ daysLeft: 60, ready: true, recommended: "quick" });

      const held = renderPlan(<BasesSheetHost />, { adviseOnBases });
      await page.getByRole("button", { name: "Open prerequisites" }).click();
      await expect.element(recommended("First lessons only")).toBeVisible();

      held.showPlan(NEXT_DAY_PLAN);
      await reopenBases();

      await expect.element(recommended("One short lesson each")).toBeVisible();
      expect(adviseOnBases).toHaveBeenCalledTimes(2);
      held.screen.unmount();
    });
  });

  it("sends no second request on a reopen while the first is still out, however long", async () => {
    await atViewport(PHONE, async () => {
      const adviseOnBases = vi.fn<PlanActions["adviseOnBases"]>(() => new Promise(() => {}));
      const held = renderPlan(<BasesSheetHost />, { adviseOnBases });

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await page.getByRole("button", { name: "Open prerequisites" }).click();
      await expect.poll(() => adviseOnBases).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(60_000);
      vi.useRealTimers();

      await reopenBases();
      await expect.element(page.getByText("Sheet open")).toBeInTheDocument();
      await settle();

      expect(adviseOnBases).toHaveBeenCalledOnce();
      held.screen.unmount();
    });
  });
});
