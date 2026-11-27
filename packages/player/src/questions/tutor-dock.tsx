"use client";

import { useTaskFootHeight } from "@zoonk/learn/task-foot-height";
import {
  TASK_ASIDE_HEADER_CLASS,
  TASK_ASIDE_PLACE_CLASS,
  TASK_GUTTER_CLASS,
} from "@zoonk/learn/task-layout";
import { BOTTOM_BAR_ROOM_CLASS } from "@zoonk/ui/components/bottom-bar";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { cn } from "@zoonk/ui/lib/utils";
import { DocumentLink } from "@zoonk/ui/patterns/links/pending";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { getLessonFocusTarget } from "../lesson/_utils/lesson-focus";
import { AskTutorFace } from "./ask-tutor-face";
import { QuestionComposer } from "./lesson-question-composer";
import { isAboutCheckedAnswer } from "./lesson-question-context";
import { LessonQuestionNavigationContext } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { type OfferedSuggestion } from "./lesson-question-state";
import { QuestionThread, TutorWelcome } from "./lesson-question-thread";
import { type TutorBuddy, useTutorBuddy } from "./tutor-buddy";
import { TutorSuggestions, useOffersSuggestions } from "./tutor-suggestions";
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
  const { loginHref } = buddy.navigation;

  return (
    <div className="flex flex-col gap-2">
      {!buddy.docked && (
        <p className="text-muted-foreground text-sm">{t("Questions need a free account")}</p>
      )}
      <DocumentLink
        className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
        href={loginHref}
      >
        {t("Create a free account")}
      </DocumentLink>
    </div>
  );
}

/** What the screen's own button asks is left out, since that button sits beside them. */
function useDockSuggestions(buddy: TutorBuddy): OfferedSuggestion[] {
  const controller = useLessonQuestionController();

  return useTutorSuggestions({
    context: buddy.context,
    lessonSuggestions: controller.suggestions,
  }).filter(({ suggestion }) => !suggestion || suggestion !== buddy.screenSuggestion);
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
        "bg-background with-aside:top-0 with-aside:bottom-(--task-aside-bottom) with-aside:z-40 with-aside:flex with-aside:flex-col hidden",
        TASK_ASIDE_PLACE_CLASS,
      )}
      data-slot="tutor-docked-conversation"
    >
      <div className={TASK_ASIDE_HEADER_CLASS}>
        <Button
          className="text-muted-foreground"
          edge="start"
          onClick={back}
          size="sm"
          variant="ghost"
        >
          <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
          {buddy.context.kind === "item"
            ? t("Back")
            : t({
                description: "Heading of the panel that recaps the lesson, not a button.",
                message: "From the lesson",
              })}
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
  const { canAskQuestions } = useLessonQuestionController();
  const dockRef = useRef<HTMLDivElement>(null);
  const offersSuggestions = useOffersSuggestions();
  const suggests = buddy.suggests && canAskQuestions && !buddy.docked && offersSuggestions;
  const suggestions = useDockSuggestions(buddy);

  useTaskFootHeight(dockRef);

  return (
    <LessonQuestionNavigationContext value={buddy.navigation}>
      {/* Only while nothing comes before it in the side panel, such as a lesson's recap; behind a recap, the suggestions sit above the composer instead. */}
      <TutorWelcome
        className="not-first:hidden"
        data-slot="tutor-intro"
        identity={buddy.identity}
        onSelect={buddy.ask}
        suggestions={suggests ? suggestions : []}
      />

      {buddy.docked && <DockedConversation buddy={buddy} />}

      <div
        className={cn("flex flex-col lg:bottom-0", TASK_ASIDE_PLACE_CLASS)}
        data-slot="tutor-dock"
        ref={dockRef}
      >
        {suggests && (
          <TutorSuggestions
            className="bg-background px-frame pb-3 [[data-slot=tutor-intro]:first-child~*_&]:hidden"
            onSelect={buddy.ask}
            suggestions={suggestions.slice(0, SUGGESTED)}
          />
        )}

        <div className={cn("bg-background px-frame", TASK_GUTTER_CLASS, BOTTOM_BAR_ROOM_CLASS)}>
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
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring/50 hit-area edge relative -me-(--edge-pull) inline-flex items-center gap-0.5 rounded-md px-1 font-sans text-xs font-medium transition-colors outline-none select-none [--edge-text-end:--spacing(1)] [--icon-size:--spacing(3.5)] focus-visible:outline-3 focus-visible:outline-solid"
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

export function TutorConversationLink({ fallback = null }: { fallback?: React.ReactNode }) {
  const buddy = useTutorBuddy();
  return buddy ? <ConversationLink buddy={buddy} fallback={fallback} /> : fallback;
}

/**
 * One size in every state, so a miss never resizes the main action beside it. On a phone it's the
 * buddy's face alone, leaving the row's room to the main action.
 */
export function TutorAskButton() {
  const t = useExtracted();
  const buddy = useTutorBuddy();

  if (!buddy) {
    return null;
  }

  const label = t("Ask {name}", { name: buddy.identity.name });

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={() => buddy.open()}
        render={
          <Button
            className="with-aside:hidden h-11 shrink-0 max-lg:w-11 max-lg:px-0"
            data-slot="question-ask"
            size="lg"
            type="button"
            variant="outline"
          />
        }
      >
        <AskTutorFace identity={buddy.identity} />
        <span className="max-lg:hidden">{t("Ask")}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
