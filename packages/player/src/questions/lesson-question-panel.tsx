"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@zoonk/ui/components/sheet";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlayerViewer } from "../player-context";
import { QuestionComposer } from "./lesson-question-composer";
import { LessonQuestionCopyAction } from "./lesson-question-copy-action";
import {
  type LessonQuestionNavigation,
  LessonQuestionNavigationContext,
} from "./lesson-question-navigation";
import { type LessonQuestionPanelMetadata } from "./lesson-question-panel-types";
import { useLessonQuestionController } from "./lesson-question-provider";
import { QuestionThread } from "./lesson-question-thread";
import { type LessonQuestionController } from "./use-lesson-questions";

function LessonQuestionPanelHeader({
  controller,
  metadata,
}: {
  controller: LessonQuestionController;
  metadata: LessonQuestionPanelMetadata;
}) {
  const t = useExtracted();

  return (
    <SheetHeader className="gap-0 border-b px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <SheetTitle>{t("Ask questions")}</SheetTitle>
        <SheetClose
          render={
            <Button
              aria-label={t("Close questions")}
              className="-mr-1"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <XIcon aria-hidden="true" />
        </SheetClose>
      </div>
      <div className="mt-0.5 -ml-2.5 self-stretch pr-2.5">
        <LessonQuestionCopyAction controller={controller} metadata={metadata} />
      </div>
      <SheetDescription className="text-xs">
        {controller.state.context.kind === "lesson"
          ? t("Ask questions about this lesson")
          : t("Part {current} of {total}", {
              current: String(controller.state.context.stepIndex + 1),
              total: String(metadata.lessonSteps.length),
            })}
      </SheetDescription>
    </SheetHeader>
  );
}

export function LessonQuestionPanel({
  navigation,
  metadata,
}: {
  navigation: LessonQuestionNavigation;
  metadata: LessonQuestionPanelMetadata;
}) {
  const controller = useLessonQuestionController();
  const { isAuthenticated } = usePlayerViewer();
  const { state } = controller;

  return (
    <LessonQuestionNavigationContext value={navigation}>
      <Sheet onOpenChange={(open) => !open && controller.close()} open={state.isOpen}>
        <SheetContent
          className="gap-0 outline-none data-[side=right]:w-full sm:max-w-md"
          showCloseButton={false}
          side="right"
        >
          <LessonQuestionPanelHeader controller={controller} metadata={metadata} />

          <div className="min-h-0 flex-1">
            <QuestionThread controller={controller} isAuthenticated={isAuthenticated} />
          </div>

          {isAuthenticated && <QuestionComposer controller={controller} />}
        </SheetContent>
      </Sheet>
    </LessonQuestionNavigationContext>
  );
}
