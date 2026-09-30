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
import { QuestionComposer } from "./lesson-question-composer";
import {
  type LessonQuestionNavigation,
  LessonQuestionNavigationContext,
} from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { QuestionThread } from "./lesson-question-thread";
import { type LessonQuestionController } from "./use-lesson-questions";

/** What the sheet is about: the part of a lesson in view, or the thing asked about as a whole. */
function LessonQuestionPanelDescription({
  context,
  stepCount,
}: {
  context: LessonQuestionController["state"]["context"];
  stepCount: number;
}) {
  const t = useExtracted();

  switch (context.kind) {
    case "answer":
    case "step":
      return t("Part {current} of {total}", {
        current: String(context.stepIndex + 1),
        total: String(stepCount),
      });
    case "chapter":
      return t("Ask questions about this chapter");
    case "lesson":
      return t("Ask questions about this lesson");
    case "mock":
      return t("Ask questions about this mock exam");
    case "plan":
      return t("Ask questions about your plan");
    default:
      return context satisfies never;
  }
}

function LessonQuestionPanelHeader({
  controller,
  stepCount,
}: {
  controller: LessonQuestionController;
  stepCount: number;
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
      <SheetDescription className="text-xs">
        <LessonQuestionPanelDescription context={controller.state.context} stepCount={stepCount} />
      </SheetDescription>
    </SheetHeader>
  );
}

/**
 * The tutor's sheet: the thread about where the learner is and, for learners who can ask, the
 * composer.
 */
export function LessonQuestionSheet({
  navigation,
  stepCount,
}: {
  navigation: LessonQuestionNavigation;
  stepCount: number;
}) {
  const controller = useLessonQuestionController();
  const { canAskQuestions, state } = controller;

  return (
    <LessonQuestionNavigationContext value={navigation}>
      <Sheet onOpenChange={(open) => !open && controller.close()} open={state.isOpen}>
        <SheetContent
          className="gap-0 outline-none data-[side=right]:w-full sm:max-w-md"
          showCloseButton={false}
          side="right"
        >
          <LessonQuestionPanelHeader controller={controller} stepCount={stepCount} />

          <div className="min-h-0 flex-1">
            <QuestionThread controller={controller} isAuthenticated={canAskQuestions} />
          </div>

          {canAskQuestions && <QuestionComposer controller={controller} />}
        </SheetContent>
      </Sheet>
    </LessonQuestionNavigationContext>
  );
}
