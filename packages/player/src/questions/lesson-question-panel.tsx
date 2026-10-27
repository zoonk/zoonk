"use client";

import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
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

/** What the conversation is about: the screen or answer in view, or the thing asked about as a whole. */
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
    case "subject":
      return t("Ask questions about this subject");
    case "item":
      return t("Ask about this question");
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
    <DrawerHeader className="border-border gap-0 border-b px-4 pt-2.5 pb-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center *:size-7!"
        >
          {identity.avatar}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <DrawerTitle className="truncate text-sm font-semibold">{identity.name}</DrawerTitle>
          <DrawerDescription className="text-xs">
            <LessonQuestionPanelDescription context={controller.state.context} />
          </DrawerDescription>
        </div>
        <DrawerClose
          render={
            <Button
              aria-label={t("Close questions")}
              className="-mr-1.5"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <XIcon aria-hidden="true" />
        </DrawerClose>
      </div>
    </DrawerHeader>
  );
}

/**
 * Inside a lesson, closing the drawer hands focus back to the lesson so Enter goes on; elsewhere
 * it returns to the button that opened it.
 */
function getFinalFocus(): HTMLElement | true {
  return getLessonFocusTarget() ?? true;
}

/**
 * Where the learner talks to their buddy about where they are, in a drawer from the bottom that
 * leaves the screen they're asking about readable above it: the buddy's face and name, what the
 * questions are about (`quote`, in a lesson), the thread and, for learners who can ask, the
 * composer. A lesson on a wide screen docks the same conversation in its aside instead.
 */
export function LessonQuestionDrawer({
  identity,
  navigation,
  open,
  quote,
}: {
  identity: TutorIdentity;
  navigation: LessonQuestionNavigation;
  open: boolean;
  /** The screen or answer asked about, quoted as the conversation's first line. */
  quote?: React.ReactNode;
}) {
  const controller = useLessonQuestionController();
  const { canAskQuestions } = controller;

  return (
    <LessonQuestionNavigationContext value={navigation}>
      <Drawer onOpenChange={(next) => !next && controller.close()} open={open}>
        <DrawerPopup
          // A light scrim: the screen asked about stays readable above the drawer.
          backdropClassName="[--backdrop-opacity:0.4] dark:[--backdrop-opacity:0.4]"
          className="h-[70dvh] max-h-[70dvh] outline-none"
          data-slot="lesson-question-drawer"
          finalFocus={getFinalFocus}
        >
          <LessonQuestionPanelHeader controller={controller} identity={identity} />

          {quote}

          <DrawerContent className="min-h-0 flex-1 overflow-hidden px-0 pb-0">
            <QuestionThread identity={identity} />
          </DrawerContent>

          {canAskQuestions && (
            <QuestionComposer
              className="px-3 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              controller={controller}
            />
          )}
        </DrawerPopup>
      </Drawer>
    </LessonQuestionNavigationContext>
  );
}
