"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@zoonk/ui/components/sheet";
import { useIsMobile } from "@zoonk/ui/hooks/mobile";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DrawerCloseButton } from "../_components/details-drawer";
import { PlanActivities } from "./plan-activities";
import { PlanBases } from "./plan-bases";
import { usePlanScreen } from "./plan-context";
import { PlanDate } from "./plan-date";
import { PlanEditRequest } from "./plan-edit-request";
import { PlanEditorChange } from "./plan-editor-change";
import { PlanEditorChangeProvider } from "./plan-editor-change-context";
import {
  type PlanEditorSection,
  findSectionControl,
  getEditorSectionId,
} from "./plan-editor-sections";
import { PlanExamChoices } from "./plan-exam-choices";
import { PlanSchedule } from "./plan-schedule";
import { PlanSteering } from "./plan-steering";
import { PlanTools } from "./plan-tools";
import { PlanWrittenPractice } from "./written-cadence";

/** A section that may have nothing to show for this plan takes no room (and no gap) then. */
const SECTION_CLASS = "flex flex-col gap-7 empty:hidden";

/** Every way to reshape the plan, in the order the editor shows them. */
function EditorSections() {
  const { plan } = usePlanScreen();

  return (
    <>
      <div className={SECTION_CLASS} id={getEditorSectionId("date")}>
        <PlanDate key={plan.schedule.targetDate ?? "none"} />
      </div>
      <PlanSchedule />
      <div className={SECTION_CLASS} id={getEditorSectionId("choices")}>
        <PlanExamChoices />
      </div>
      <PlanBases />
      <div className={SECTION_CLASS} id={getEditorSectionId("practice")}>
        <PlanActivities />
      </div>
      <PlanWrittenPractice />
      <PlanSteering />
      <PlanTools />
      <PlanEditRequest />
    </>
  );
}

/** Every change is saved as it's made, so the frame's only way out is "Close". */
type EditorFrameProps = {
  /** Where focus lands on opening: the section's first control, or the frame's default. */
  initialFocus: () => HTMLElement | true;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * From a tablet up, a panel on the right over the page's aside: the page beside it stays in sight
 * behind a light backdrop, so each change visibly re-plans the roadmap and the subjects. The
 * latest change sits under the title, where the eye lands after a tap.
 */
function EditorPanel({ initialFocus, onOpenChange, open }: EditorFrameProps) {
  const t = useExtracted();

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="gap-0 shadow-none data-[side=right]:w-full data-[side=right]:sm:max-w-104"
        initialFocus={initialFocus}
        overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-none dark:bg-black/25"
        side="right"
      >
        <PlanEditorChangeProvider>
          <SheetHeader className="flex-row items-center justify-between gap-3 px-6 pt-5 pb-3">
            <SheetTitle className="text-xl font-semibold">{t("Adjust your plan")}</SheetTitle>
            <SheetClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Close")}</span>
            </SheetClose>
          </SheetHeader>

          <PlanEditorChange className="border-t-0 border-b pt-0 pb-4" />

          <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-6 pt-4 pb-8">
            <EditorSections />
          </div>
        </PlanEditorChangeProvider>
      </SheetContent>
    </Sheet>
  );
}

/** On a phone, the bottom sheet, its latest change pinned at its foot in thumb reach. */
function EditorSheet({ initialFocus, onOpenChange, open }: EditorFrameProps) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup initialFocus={initialFocus}>
        <PlanEditorChangeProvider>
          <DrawerHeader className="flex-row items-center justify-between gap-3">
            <DrawerTitle className="text-xl font-semibold">{t("Adjust your plan")}</DrawerTitle>
            <DrawerCloseButton />
          </DrawerHeader>

          <DrawerContent className="flex flex-col gap-7 pt-2">
            <EditorSections />
          </DrawerContent>

          <PlanEditorChange />
        </PlanEditorChangeProvider>
      </DrawerPopup>
    </Drawer>
  );
}

/**
 * "Adjust your plan": everything that reshapes it, in a panel on the right from a tablet up and a
 * bottom sheet on a phone. The goal's date (or none, to study everything), time a day and study
 * days, the option the learner takes of each of an exam's choices (ENEM's foreign language), how
 * to study an exam's prerequisites, what a language plan practices, when an exam's written tests
 * are practiced, how the lessons feel, the tools it needs, and anything else in the learner's own
 * words. Each change re-plans from today and shows on the page at once, and the editor says what
 * the latest one did, with Undo (see `PlanEditorChange`). Opened at a `section` (a setting the
 * Plan lists), it focuses that setting's first control.
 */
export function PlanEditor({
  onOpenChange,
  open,
  section = null,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  section?: PlanEditorSection | null;
}) {
  const isPhone = useIsMobile();
  const initialFocus = () => (section && findSectionControl(section)) || true;
  const props = { initialFocus, onOpenChange, open };

  return isPhone ? <EditorSheet {...props} /> : <EditorPanel {...props} />;
}
