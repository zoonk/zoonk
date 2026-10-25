"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { LibraryBigIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useEffect, useEffectEvent, useState } from "react";
import { useCloseSuggestionSheet } from "../_components/suggestion";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { PendingLabel } from "./plan-coverage";
import { PlanFailedMessage } from "./plan-failed-message";
import { type FullCourse, useFullCourse, useFullCourseText } from "./plan-full-course";
import { currentPlanPreview } from "./plan-preview-state";
import { usePlanChange } from "./use-plan-change";
import { usePlanPreview, usePreviewBase } from "./use-plan-preview";

/**
 * When studying everything would end, before the learner chooses it: the plan's own end when it's
 * that already (see `useFullCourse`), or else the end of the change previewed, planned as choosing
 * it plans it, asked once the sheet shows (`asking`, until the learner chooses) and again if the
 * plan changes meanwhile. `checking` while it's on its way; a failed check leaves only what's sure.
 */
function useFullCourseEnd({ asking, course }: { asking: boolean; course: FullCourse }) {
  const { plan } = usePlanScreen();
  const base = usePreviewBase();
  const { preview, requestPreview } = usePlanPreview();
  const operations = course.operations(true);
  const ask = asking && course.endDate === null;
  const state = currentPlanPreview({ operations, plan, state: preview });

  const load = useEffectEvent((revision: object) => {
    if (revision === base) {
      return requestPreview(operations);
    }
  });

  useEffect(() => {
    if (ask) {
      void load(base);
    }
  }, [ask, base]);

  return {
    checking: ask && (state.status === "idle" || state.status === "loading"),
    endDate:
      course.endDate ??
      (state.status === "ready" ? (state.preview.effect?.endDateAfter ?? null) : null),
  };
}

/**
 * The sheet's body: what studying everything changes before they choose it, with when they'd
 * finish (see `useFullCourseEnd`), then what their choice did, with Undo, which says when they
 * finish.
 */
function FullCourseChoice({ course, onDone }: { course: FullCourse; onDone: () => void }) {
  const t = useExtracted();
  const text = useFullCourseText();
  const { change, failed, isPending } = usePlanChange();
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);
  const end = useFullCourseEnd({ asking: !isPending && outcome === null, course });
  const finish = text.finish({ ...course, endDate: end.endDate });

  if (outcome?.status === "applied" && outcome.change) {
    return <PlanChangeApplied change={outcome.change} icon={LibraryBigIcon} onDone={onDone} />;
  }

  const choose = () =>
    change(course.operations(true), (saved) => {
      // A plan not built yet keeps the choice for when it is: there's no change to show.
      if (saved?.status === "applied" && !saved.change) {
        onDone();
        return;
      }

      setOutcome(saved);
    });

  return (
    <>
      <DrawerContent className="flex flex-col gap-3 pt-2">
        {finish && <p className="font-medium text-pretty">{finish}</p>}
        {end.checking && (
          <p className="text-muted-foreground text-sm" role="status">
            {t("Checking what changes…")}
          </p>
        )}
        <p className="text-muted-foreground text-sm text-pretty">{text.rule(course)}</p>
      </DrawerContent>

      <div className="flex flex-col gap-2 border-t px-6 pt-4 pb-6">
        <Button
          aria-busy={isPending || undefined}
          disabled={isPending}
          focusableWhenDisabled
          onClick={() => void choose()}
        >
          <PendingLabel pending={isPending}>{t("Study everything")}</PendingLabel>
        </Button>
        <DrawerClose render={<Button variant="outline" />}>{t("Cancel")}</DrawerClose>
        {failed && <PlanFailedMessage />}
      </div>
    </>
  );
}

/** The sheet as last opened: the course it was opened for stays while it shows what it did. */
type Shown = { course: FullCourse; open: boolean };

function StudyEverythingSheet({
  onOpenChange,
  shown,
}: {
  onOpenChange: (open: boolean) => void;
  shown: Shown;
}) {
  const t = useExtracted();
  const { course, open } = shown;

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold">{t("Study everything")}</DrawerTitle>
            <DrawerDescription>
              {course.isExam
                ? t("Every topic, even after the exam, at your own pace.")
                : t("Every part of your goal, at your own pace, with no end date.")}
            </DrawerDescription>
          </div>
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>

        {open && <FullCourseChoice course={course} onDone={() => onOpenChange(false)} />}
      </DrawerPopup>
    </Drawer>
  );
}

const StudyEverythingContext = createContext<((course: FullCourse) => void) | null>(null);

/**
 * Holds the "Study everything" sheet for a plan screen, so it stays on what the choice did (with
 * Undo) after what opened it leaves: the notice once the plan covers everything, the editor's
 * button once the deadline is gone, the reveal's row. `openOnArrival` opens it when the host
 * opened the plan to choose it (Today's offer).
 */
export function StudyEverythingHost({
  children,
  openOnArrival = false,
}: {
  children: React.ReactNode;
  openOnArrival?: boolean;
}) {
  const course = useFullCourse();

  const [shown, setShown] = useState<Shown | null>(() =>
    openOnArrival && course ? { course, open: true } : null,
  );

  return (
    <StudyEverythingContext value={(next) => setShown({ course: next, open: true })}>
      {children}
      {shown && (
        <StudyEverythingSheet onOpenChange={(open) => setShown({ ...shown, open })} shown={shown} />
      )}
    </StudyEverythingContext>
  );
}

/** Opens the screen's "Study everything" sheet for the course (see `StudyEverythingHost`). */
export function useStudyEverything(): (course: FullCourse) => void {
  const open = use(StudyEverythingContext);

  if (!open) {
    throw new Error("Study everything must be used within StudyEverythingHost");
  }

  return open;
}

/**
 * Opens the "Study everything" sheet from a suggestion, in the place of the suggestion's own sheet
 * (see `useCloseSuggestionSheet`), so closing it leaves the page.
 */
export function useStudyEverythingFromSuggestion(): (course: FullCourse) => void {
  const open = useStudyEverything();
  const closeSheet = useCloseSuggestionSheet();

  return (course) => {
    closeSheet();
    open(course);
  };
}

/**
 * "Study everything", next to more time a day and choosing where to focus, for a plan whose time
 * doesn't cover its goal by its date: one small button on the notice's line of answers, opening
 * the sheet that says what studying everything at their time changes (an exam's goes on after the
 * exam, which keeps its date) before they choose it.
 */
export function StudyEverything({ course }: { course: FullCourse }) {
  const t = useExtracted();
  const open = useStudyEverything();

  return (
    <Button
      className="self-start"
      onClick={() => open(course)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {t("Study everything")}
    </Button>
  );
}
