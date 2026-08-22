"use client";

import { type AppRoute } from "@/i18n/navigation";
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
import { LessonQuestionCopyAction } from "./lesson-question-copy-action";
import { type LessonQuestionPanelMetadata } from "./lesson-question-panel-types";
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
      <div className="mt-0.5 -ml-2.5 self-start">
        <LessonQuestionCopyAction controller={controller} metadata={metadata} />
      </div>
      <SheetDescription className="sr-only">
        {t("Ask questions about the lesson content")}
      </SheetDescription>
    </SheetHeader>
  );
}

export function LessonQuestionPanel<const Href extends string>({
  controller,
  isAuthenticated,
  loginHref,
  metadata,
}: {
  controller: LessonQuestionController;
  isAuthenticated: boolean;
  loginHref: AppRoute<Href>;
  metadata: LessonQuestionPanelMetadata;
}) {
  const { state } = controller;

  return (
    <Sheet onOpenChange={(open) => !open && controller.close()} open={state.isOpen}>
      <SheetContent
        className="gap-0 outline-none data-[side=right]:w-full sm:max-w-md"
        showCloseButton={false}
        side="right"
      >
        <LessonQuestionPanelHeader controller={controller} metadata={metadata} />

        <div className="min-h-0 flex-1">
          <QuestionThread
            controller={controller}
            isAuthenticated={isAuthenticated}
            loginHref={loginHref}
          />
        </div>

        <QuestionComposer
          controller={controller}
          isAuthenticated={isAuthenticated}
          loginHref={loginHref}
        />
      </SheetContent>
    </Sheet>
  );
}
