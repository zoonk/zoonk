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

/** How many of the buddy's suggested questions the aside offers over its composer. */
const SUGGESTED = 2;

/** What the aside's composer asks about, for its label. */
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

/**
 * The buddy's composer at the foot of the aside, always there beside the task: what the learner
 * writes is about where they are (the screen or question in view, or their answer once it's
 * checked), and sending it shows the conversation in the aside. Its placeholder only names the
 * buddy, by its face, so it fits the aside's one line in every language, and its label says what
 * the learner asks about.
 */
function DockComposer({ buddy }: { buddy: TutorBuddy }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const label = useComposerLabel(buddy);
  const { docked } = buddy;
  const { state } = controller;

  // Once the conversation shows in the aside, the learner writes (or sends a ready suggestion)
  // without reaching for the composer.
  useEffect(() => {
    if (docked) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [docked]);

  // The composer sends about where the learner is, whatever the conversation last opened about.
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

/** A visitor or guest sees where the buddy is, and the way to an account that can ask it. */
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

/**
 * Two of the buddy's suggested questions for where the learner is, each sent with one tap: about
 * the answer after a wrong one, or a lesson's own on its reading screens.
 */
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

/**
 * The conversation docked over the aside from `lg`, above the dock, from the aside's top with its
 * own header row in place of the aside's, and the way back to what the aside showed: the task stays
 * beside it, and its keys keep working.
 */
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

/**
 * The buddy at the foot of a task's aside from `lg` (a lesson, a session's block, mistakes
 * practice), level with the action bar: its composer (for a visitor, the way to an account), two
 * suggested questions over it when the host offers them, and the conversation over the aside once
 * the learner asks. The aside's content ends where the dock starts.
 */
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

/**
 * The way back to the conversation about where the learner is (a lesson's screen, a run's
 * question), on the task aside's header once they have asked about it: the buddy's face, as the
 * open conversation shows it in the same corner, and how many questions it holds, so beside
 * "Today" it never reads as questions left in the day. Until then, and without a buddy, the
 * header's own quiet fact (`fallback`: the screen's number, the minutes left) shows there.
 */
export function TutorConversationLink({ fallback }: { fallback: React.ReactNode }) {
  const buddy = useTutorBuddy();
  return buddy ? <ConversationLink buddy={buddy} fallback={fallback} /> : fallback;
}

/**
 * One quiet way to ask the buddy about where the learner is, after the task's main action: an
 * icon, and "Ask {buddy}" in words after a wrong answer, when asking helps most, unless the screen
 * already offers the buddy by name (`quiet`). From `lg` the buddy's composer is in the aside, so
 * the bar leaves it out.
 */
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
