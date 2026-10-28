"use client";

import { useTaskFootHeight } from "@zoonk/learn/task-foot-height";
import { TASK_ASIDE_PLACE_CLASS } from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, MessageCircleQuestionIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { getLessonFocusTarget } from "../lesson/_utils/lesson-focus";
import { QuestionComposer } from "./lesson-question-composer";
import { isAboutCheckedAnswer } from "./lesson-question-context";
import { getQuestionLimit } from "./lesson-question-errors";
import { LessonQuestionNavigationContext } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { QuestionThread } from "./lesson-question-thread";
import { type TutorBuddy, useTutorBuddy } from "./tutor-buddy";
import { type LessonQuestionController } from "./use-lesson-questions";
import { useTutorSuggestions } from "./use-tutor-suggestions";

const SUGGESTED = 2;

function useComposerLabel({ context, identity }: TutorBuddy): string {
  const t = useExtracted();
  const { name } = identity;

  if (isAboutCheckedAnswer(context)) {
    return t("Ask {name} about your answer", { name });
  }

  if (context.kind === "item") {
    return t("Ask {name} about this question", { name });
  }

  return t("Ask {name} about this screen", { name });
}

function DockComposer({ buddy }: { buddy: TutorBuddy }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const label = useComposerLabel(buddy);
  const { docked } = buddy;
  const { state } = controller;

  useEffect(() => {
    if (docked) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [docked]);

  const dockController = useMemo<LessonQuestionController>(
    () => ({
      ...controller,
      send: () => {
        const question = state.draft.trim();

        buddy.ask({
          question,
          suggestion:
            question === state.suggestion?.question ? state.suggestion.suggestion : undefined,
        });

        return Promise.resolve();
      },
    }),
    [buddy, controller, state.draft, state.suggestion],
  );

  return (
    <QuestionComposer
      avatar={buddy.identity.avatar}
      controller={dockController}
      inputRef={inputRef}
      label={label}
      placeholder={t("Ask {name}", { name: buddy.identity.name })}
    />
  );
}

function DockSignUp({ buddy }: { buddy: TutorBuddy }) {
  const t = useExtracted();
  const { linkComponent: LinkComponent, loginHref } = buddy.navigation;

  return (
    <LinkComponent
      className="bg-card ring-input rounded-option text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-2.5 px-2.5 text-sm ring-1 transition-colors ring-inset"
      href={loginHref}
      prefetch={false}
    >
      <span
        aria-hidden="true"
        className="flex size-5.5 shrink-0 items-center justify-center *:size-5.5!"
      >
        {buddy.identity.avatar}
      </span>
      {t("Create a free account to ask questions")}
    </LinkComponent>
  );
}

function DockSuggestions({ buddy }: { buddy: TutorBuddy }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();

  const suggestions = useTutorSuggestions({
    context: buddy.context,
    lessonSuggestions: controller.suggestions,
  }).slice(0, SUGGESTED);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={t("Suggested questions")}
      className="bg-background flex flex-wrap gap-2 px-5 pb-3"
      role="group"
    >
      {suggestions.map((suggestion) => (
        <Button
          className="h-auto min-h-7.5 py-1 text-left whitespace-normal"
          key={suggestion.question}
          onClick={() => buddy.ask(suggestion)}
          size="sm"
          type="button"
          variant="outline"
        >
          {suggestion.question}
        </Button>
      ))}
    </div>
  );
}

function DockedConversation({ buddy }: { buddy: TutorBuddy }) {
  const t = useExtracted();

  const back = () => {
    buddy.close();
    getLessonFocusTarget()?.focus({ preventScroll: true });
  };

  return (
    <section
      aria-label={t("Questions to {name}", { name: buddy.identity.name })}
      className={cn(
        "bg-background hidden lg:top-0 lg:bottom-(--task-aside-bottom) lg:z-40 lg:flex lg:flex-col",
        TASK_ASIDE_PLACE_CLASS,
      )}
      data-slot="tutor-docked-conversation"
    >
      <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-5 xl:h-15">
        <Button
          className="text-muted-foreground -ml-1 px-2"
          onClick={back}
          size="sm"
          variant="ghost"
        >
          <ChevronLeftIcon aria-hidden="true" />
          {buddy.context.kind === "item" ? t("Back") : t("From the lesson")}
        </Button>

        <p className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs font-medium">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center *:size-5!"
          >
            {buddy.identity.avatar}
          </span>
          <span className="truncate">{buddy.identity.name}</span>
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <QuestionThread identity={buddy.identity} />
      </div>
    </section>
  );
}

function Dock({ buddy }: { buddy: TutorBuddy }) {
  const { canAskQuestions, state } = useLessonQuestionController();
  const dockRef = useRef<HTMLDivElement>(null);
  const suggests = buddy.suggests && canAskQuestions && !buddy.docked && !getQuestionLimit(state);

  useTaskFootHeight(dockRef);

  return (
    <LessonQuestionNavigationContext value={buddy.navigation}>
      {buddy.docked && <DockedConversation buddy={buddy} />}

      <div
        className={cn("flex flex-col lg:bottom-0", TASK_ASIDE_PLACE_CLASS)}
        data-slot="tutor-dock"
        ref={dockRef}
      >
        {suggests && <DockSuggestions buddy={buddy} />}

        <div className="bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {canAskQuestions ? <DockComposer buddy={buddy} /> : <DockSignUp buddy={buddy} />}
        </div>
      </div>
    </LessonQuestionNavigationContext>
  );
}

export function TutorDock() {
  const buddy = useTutorBuddy();
  return buddy ? <Dock buddy={buddy} /> : null;
}

function ConversationLink({ buddy, fallback }: { buddy: TutorBuddy; fallback: React.ReactNode }) {
  const t = useExtracted();
  const count = useLessonQuestionController().state.questions.length;

  if (count === 0) {
    return fallback;
  }

  return (
    <button
      aria-label={t("{count, plural, one {# question to {name}} other {# questions to {name}}}", {
        count,
        name: buddy.identity.name,
      })}
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring hit-area relative -mr-1 inline-flex items-center gap-0.5 rounded-md px-1 font-sans text-xs font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid"
      onClick={() => buddy.open()}
      type="button"
    >
      <span
        aria-hidden="true"
        className="mr-1.5 flex size-5 shrink-0 items-center justify-center *:size-5!"
      >
        {buddy.identity.avatar}
      </span>
      {t("{count, plural, one {# question} other {# questions}}", { count })}
      <ChevronRightIcon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

export function TutorConversationLink({ fallback }: { fallback: React.ReactNode }) {
  const buddy = useTutorBuddy();
  return buddy ? <ConversationLink buddy={buddy} fallback={fallback} /> : fallback;
}

export function TutorAskButton({ quiet = false }: { quiet?: boolean }) {
  const t = useExtracted();
  const buddy = useTutorBuddy();

  if (!buddy) {
    return null;
  }

  const label = t("Ask {name}", { name: buddy.identity.name });

  if (buddy.missed && !quiet) {
    return (
      <Button
        className="lg:hidden"
        onClick={() => buddy.open()}
        size="lg"
        type="button"
        variant="outline"
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={() => buddy.open()}
        render={
          <Button
            className="size-11 shrink-0 lg:hidden"
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
