import { cleanup } from "@testing-library/react";
import { planTimeToCoverSchema } from "@zoonk/core/plans/time-advice-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type PlanActions, PlanScreenProvider } from "../../../learn/src/plan/plan-context";
import { PlanEditor } from "../../../learn/src/plan/plan-editor";
import { PlanSheetHosts } from "../../../learn/src/plan/plan-sheet-hosts";
import {
  PlanSuggestionProvider,
  PlanSuggestionSlot,
} from "../../../learn/src/plan/plan-suggestion";
import { type PlanSuggestionHost } from "../../../learn/src/plan/plan-suggestion-context";
import { atViewport } from "../_test-utils/browser-viewport";
import { render } from "../_test-utils/render";

const PHONE = { height: 844, width: 390 };
const LAPTOP = { height: 900, width: 1440 };

const FIT_EFFECT = { endDateAfter: null, endDateBefore: null, lessonsAdded: 4, lessonsRemoved: 0 };

const PLAN = {
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
    canApply: true,
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
} satisfies PlanView;

/** The Plan draws its suggestion twice: in the column below 72rem, in the aside from there. */
const EDITOR_PANEL_WIDTH = 768;

function isSidePanelShown(): boolean {
  return document.querySelector("[data-slot='side-panel-content']") !== null;
}

/** The editor opens as a sheet below 768px and as a side panel from it. */
function renderEditor() {
  const heldChange = Promise.withResolvers<Awaited<ReturnType<PlanActions["change"]>>>();
  const change = vi.fn<PlanActions["change"]>(() => heldChange.promise);

  const actions: PlanActions = {
    adviseOnBases: async () => null,
    change,
    chooseExamOption: async () => null,
    chooseTools: async () => false,
    decide: async () => false,
    findTimeToCover: async () => null,
    preview: async () => null,
  };

  render(
    <PlanScreenProvider
      value={{
        actions,
        goal: { displayName: "Learn Spanish", kind: "learn" },
        plan: PLAN,
        shareHref: "/plan",
      }}
    >
      <PlanSheetHosts>
        <PlanEditor onOpenChange={vi.fn()} open />
      </PlanSheetHosts>
    </PlanScreenProvider>,
  );

  return { change, releaseChange: () => heldChange.resolve({ change: null, status: "applied" }) };
}

function renderPlanSlots({
  findTimeToCover = async () => null,
  host,
  plan,
}: {
  findTimeToCover?: PlanActions["findTimeToCover"];
  host: PlanSuggestionHost;
  plan: PlanView;
}) {
  const heldChange = Promise.withResolvers<Awaited<ReturnType<PlanActions["change"]>>>();
  const change = vi.fn<PlanActions["change"]>(() => heldChange.promise);

  const actions: PlanActions = {
    adviseOnBases: async () => null,
    change,
    chooseExamOption: async () => null,
    chooseTools: async () => false,
    decide: async () => false,
    findTimeToCover,
    preview: async () => null,
  };

  render(
    <PlanScreenProvider
      value={{
        actions,
        goal: { displayName: "Learn Spanish", kind: "learn" },
        plan,
        shareHref: "/plan",
      }}
    >
      <PlanSuggestionProvider host={host}>
        <PlanSuggestionSlot className="hidden min-[72rem]:block" />
        <PlanSuggestionSlot className="min-[72rem]:hidden" />
      </PlanSuggestionProvider>
    </PlanScreenProvider>,
  );

  return { change, releaseChange: () => heldChange.resolve({ change: null, status: "applied" }) };
}

/** The one the learner sees: the other copy is in the DOM, hidden at this width. */
function shownButton(name: string): Element | undefined {
  return page
    .getByRole("button", { name })
    .elements()
    .find((element) => element.checkVisibility());
}

function isBusy(name: string): boolean {
  return shownButton(name)?.getAttribute("aria-busy") === "true";
}

function isTextShown(text: string): boolean {
  return page
    .getByText(text)
    .elements()
    .some((element) => element.checkVisibility());
}

/**
 * Crosses the breakpoint and shows the suggestion as the learner then sees it: from 72rem the
 * panel (a sheet left open from the phone width is closed), below it the sheet "View" opens.
 */
async function cross(to: { height: number; width: number }, { sheet = true } = {}) {
  await page.viewport(to.width, to.height);

  if (to.width >= LAPTOP.width) {
    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() => {
      if (page.getByRole("dialog").elements().length > 0) {
        throw new Error("The sheet opened at the phone width is still open.");
      }
    });

    return;
  }

  if (sheet) {
    await press("View");
  }
}

async function press(name: string) {
  await expect.poll(() => shownButton(name)).toBeDefined();
  const button = shownButton(name);

  if (button instanceof HTMLElement) {
    await userEvent.click(button);
  }
}

const HOST_BASE = {
  courseHref: () => "/course",
  goalStatus: null,
  next: null,
  onAdjust: vi.fn(),
  onEdit: vi.fn(),
} satisfies Omit<PlanSuggestionHost, "certificates">;

describe.each([
  { from: PHONE, to: LAPTOP },
  { from: LAPTOP, to: PHONE },
])("a Plan suggestion's request from $from.width to $to.width px", ({ from, to }) => {
  afterEach(cleanup);

  it(`keeps "Add to my plan" busy and adds once`, async () => {
    await atViewport(from, async () => {
      const held = renderPlanSlots({ host: { ...HOST_BASE, certificates: null }, plan: PLAN });

      if (from === PHONE) {
        await press("View");
      }

      await press("Add to my plan");
      await expect.poll(() => held.change).toHaveBeenCalledOnce();

      await cross(to);

      await expect.poll(() => isBusy("Add to my plan")).toBe(true);

      held.releaseChange();

      await expect.poll(() => isTextShown("Your plan is updated.")).toBe(true);
      expect(held.change).toHaveBeenCalledOnce();
    });
  });

  it(`keeps "Get your certificate" busy and says a failure`, async () => {
    await atViewport(from, async () => {
      const claim = Promise.withResolvers<boolean>();
      const onClaim = vi.fn(() => claim.promise);

      renderPlanSlots({
        host: {
          ...HOST_BASE,
          certificates: { onClaim, unclaimed: [{ courseLevel: "beginner" }], view: null },
        },
        plan: { ...PLAN, fitOffer: null },
      });

      await press("Get your certificate");
      await expect.poll(() => onClaim).toHaveBeenCalledOnce();

      await cross(to, { sheet: false });
      await expect.poll(() => isBusy("Get your certificate")).toBe(true);

      claim.resolve(false);

      await expect.poll(() => isTextShown("That didn't save. Try again.")).toBe(true);

      expect(onClaim).toHaveBeenCalledOnce();
    });
  });

  it(`keeps a date search going and shows its date`, async () => {
    await atViewport(from, async () => {
      const found = Promise.withResolvers<Awaited<ReturnType<PlanActions["findTimeToCover"]>>>();
      const findTimeToCover = vi.fn(() => found.promise);

      renderPlanSlots({
        findTimeToCover,
        host: { ...HOST_BASE, certificates: null },
        plan: { ...PLAN, fitOffer: null, status: { kind: "pastDate", lessons: 3 } },
      });

      if (from === PHONE) {
        await press("View");
      }

      await press("Find a date");
      await expect.poll(() => findTimeToCover).toHaveBeenCalledOnce();

      await cross(to);

      await expect.poll(() => isTextShown("Checking what changes…")).toBe(true);

      found.resolve(
        planTimeToCoverSchema.parse({
          fittingDate: "2027-01-10",
          pastDate: true,
          ready: true,
          recommendedMinutes: null,
          suggested: null,
          targetDate: null,
          targetDateNamedMonth: false,
        }),
      );

      await expect.poll(() => isTextShown("Move your end date to January 10, 2027?")).toBe(true);
      expect(findTimeToCover).toHaveBeenCalledOnce();
    });
  });
});

describe.each([
  { from: PHONE, to: { height: 900, width: 1024 } },
  { from: { height: 900, width: 1024 }, to: PHONE },
])("the plan editor's save from $from.width to $to.width px", ({ from, to }) => {
  afterEach(cleanup);

  it("keeps Save busy in the frame the resize brings and saves once", async () => {
    await atViewport(from, async () => {
      const held = renderEditor();
      const field = page.getByLabelText("End date");
      await field.fill("2027-04-01");
      await press("Save");
      await expect.poll(() => held.change).toHaveBeenCalledOnce();

      await page.viewport(to.width, to.height);
      await expect.poll(isSidePanelShown).toBe(to.width >= EDITOR_PANEL_WIDTH);
      await expect.poll(() => isBusy("Save")).toBe(true);

      held.releaseChange();

      await expect.poll(() => isBusy("Save")).toBe(false);
      expect(held.change).toHaveBeenCalledOnce();
    });
  });
});
