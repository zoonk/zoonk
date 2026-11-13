"use client";

import { Button } from "@zoonk/ui/components/button";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
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
import { PlanActivities } from "./plan-activities";
import { PlanAim } from "./plan-aim";
import { PlanBases } from "./plan-bases";
import { PlanCountry } from "./plan-country";
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
import { PlanLanguage } from "./plan-language";
import { PlanSchedule } from "./plan-schedule";
import { PlanSteering } from "./plan-steering";
import { PlanTools } from "./plan-tools";
import { PlanWrittenPractice } from "./written-cadence";

const SECTION_CLASS = "flex flex-col gap-7 empty:hidden";

function EditorSections() {
  return (
    <>
      <div className={SECTION_CLASS} id={getEditorSectionId("date")}>
        <PlanDate />
      </div>
      <PlanAim />
      <PlanSchedule />
      <div className={SECTION_CLASS} id={getEditorSectionId("choices")}>
        <PlanExamChoices />
      </div>
      <PlanBases />
      <div className={SECTION_CLASS} id={getEditorSectionId("language")}>
        <PlanLanguage />
      </div>
      <div className={SECTION_CLASS} id={getEditorSectionId("country")}>
        <PlanCountry />
      </div>
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

type EditorFrameProps = {
  initialFocus: () => HTMLElement | true;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

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
            <SheetClose render={<Button edge="end" size="icon" variant="ghost" />}>
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

function EditorSheet({ initialFocus, onOpenChange, open }: EditorFrameProps) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup initialFocus={initialFocus}>
        <PlanEditorChangeProvider>
          <SheetHeader>
            <DrawerTitle className="text-xl font-semibold">{t("Adjust your plan")}</DrawerTitle>
          </SheetHeader>

          <DrawerContent className="flex flex-col gap-7 pt-2">
            <EditorSections />
          </DrawerContent>

          <PlanEditorChange />
        </PlanEditorChangeProvider>
      </DrawerPopup>
    </Drawer>
  );
}

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
