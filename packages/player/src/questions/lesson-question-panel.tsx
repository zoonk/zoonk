"use client";

import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
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
import { getLessonFocusTarget } from "../lesson/_utils/lesson-focus";
import { QuestionComposer } from "./lesson-question-composer";
import {
  type LessonQuestionNavigation,
  LessonQuestionNavigationContext,
} from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { QuestionThread } from "./lesson-question-thread";
import { type LessonQuestionController } from "./use-lesson-questions";

/** What the sheet is about: the screen or answer in view, or the thing asked about as a whole. */
function LessonQuestionPanelDescription({
  context,
}: {
  context: LessonQuestionController["state"]["context"];
}) {
  const t = useExtracted();

  switch (context.kind) {
    case "answer":
      return t("Ask about your answer");
    case "step":
      return t("Ask about this screen");
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

/** The buddy the learner is talking to, by face and name, and what the questions are about. */
function LessonQuestionPanelHeader({
  controller,
  identity,
}: {
  controller: LessonQuestionController;
  identity: TutorIdentity;
}) {
  const t = useExtracted();

  return (
    <SheetHeader className="gap-0 border-b px-3 py-3 sm:px-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center">
          {identity.avatar}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <SheetTitle className="truncate">{identity.name}</SheetTitle>
          <SheetDescription className="text-xs">
            <LessonQuestionPanelDescription context={controller.state.context} />
          </SheetDescription>
        </div>
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
    </SheetHeader>
  );
}

/**
 * Inside a lesson, closing the sheet hands focus back to the lesson so Enter goes on; elsewhere
 * it returns to the button that opened it.
 */
function getFinalFocus(): HTMLElement | true {
  return getLessonFocusTarget() ?? true;
}

/**
 * The questions sheet, where the learner talks to their buddy about where they are: the thread
 * and, for learners who can ask, the composer.
 */
export function LessonQuestionSheet({
  identity,
  navigation,
}: {
  identity: TutorIdentity;
  navigation: LessonQuestionNavigation;
}) {
  const controller = useLessonQuestionController();
  const { canAskQuestions, state } = controller;

  return (
    <LessonQuestionNavigationContext value={navigation}>
      <Sheet onOpenChange={(open) => !open && controller.close()} open={state.isOpen}>
        <SheetContent
          className="gap-0 outline-none data-[side=right]:w-full sm:max-w-md"
          finalFocus={getFinalFocus}
          side="right"
        >
          <LessonQuestionPanelHeader controller={controller} identity={identity} />

          <div className="min-h-0 flex-1">
            <QuestionThread
              controller={controller}
              identity={identity}
              isAuthenticated={canAskQuestions}
            />
          </div>

          {canAskQuestions && <QuestionComposer controller={controller} />}
        </SheetContent>
      </Sheet>
    </LessonQuestionNavigationContext>
  );
}
