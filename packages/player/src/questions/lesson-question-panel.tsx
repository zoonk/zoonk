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

function getFinalFocus(): HTMLElement | true {
  return getLessonFocusTarget() ?? true;
}

export function LessonQuestionDrawer({
  identity,
  navigation,
  open,
  quote,
}: {
  identity: TutorIdentity;
  navigation: LessonQuestionNavigation;
  open: boolean;
  quote?: React.ReactNode;
}) {
  const controller = useLessonQuestionController();
  const { canAskQuestions } = controller;

  return (
    <LessonQuestionNavigationContext value={navigation}>
      <Drawer onOpenChange={(next) => !next && controller.close()} open={open}>
        <DrawerPopup
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
