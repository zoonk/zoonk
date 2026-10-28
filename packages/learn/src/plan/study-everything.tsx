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
import { LibraryBigIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useEffect, useEffectEvent, useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { ChangeSaveError } from "../_components/save-error";
import { useCloseSuggestionSheet } from "../_components/suggestion";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { PendingLabel } from "./plan-coverage";
import { type FullCourse, useFullCourse, useFullCourseText } from "./plan-full-course";
import { currentPlanPreview } from "./plan-preview-state";
import { usePlanChange } from "./use-plan-change";
import { usePlanPreview, usePreviewBase } from "./use-plan-preview";

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
        {failed && <ChangeSaveError />}
      </div>
    </>
  );
}

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
          <DrawerCloseButton />
        </DrawerHeader>

        {open && <FullCourseChoice course={course} onDone={() => onOpenChange(false)} />}
      </DrawerPopup>
    </Drawer>
  );
}

const StudyEverythingContext = createContext<((course: FullCourse) => void) | null>(null);

/**
 * Held by the plan screen, so the sheet stays on what the choice did (with Undo) after what opened
 * it leaves.
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

export function useStudyEverything(): (course: FullCourse) => void {
  const open = use(StudyEverythingContext);

  if (!open) {
    throw new Error("Study everything must be used within StudyEverythingHost");
  }

  return open;
}

export function useStudyEverythingFromSuggestion(): (course: FullCourse) => void {
  const open = useStudyEverything();
  const closeSheet = useCloseSuggestionSheet();

  return (course) => {
    closeSheet();
    open(course);
  };
}

export function StudyEverything({ course }: { course: FullCourse }) {
  const t = useExtracted();
  const open = useStudyEverything();

  return (
    <Button
      className="self-start"
      onClick={() => open(course)}
      size="sm"
      type="button"
      variant="outline"
    >
      {t("Study everything")}
    </Button>
  );
}
