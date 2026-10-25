"use client";

import { useTaskFootHeight } from "@zoonk/learn/task-foot-height";
import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button } from "@zoonk/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { QuestionComposer } from "../../questions/lesson-question-composer";
import { type LessonQuestionContext } from "../../questions/lesson-question-context";
import { getQuestionLimit } from "../../questions/lesson-question-errors";
import {
  type LessonQuestionNavigation,
  LessonQuestionNavigationContext,
} from "../../questions/lesson-question-navigation";
import { useLessonQuestionController } from "../../questions/lesson-question-provider";
import { QuestionThread } from "../../questions/lesson-question-thread";
import {
  DOCKED_CONVERSATION_CLASS,
  TUTOR_DOCK_BAR_CLASS,
  TUTOR_DOCK_CLASS,
} from "../../questions/tutor-dock-layout";
import { type LessonQuestionController } from "../../questions/use-lesson-questions";
import { useTutorSuggestions } from "../../questions/use-tutor-suggestions";
import { getLessonFocusTarget } from "../_utils/lesson-focus";
import { isLanguageStep, isReadStep } from "../_utils/lesson-steps";
import { useLessonPlayer } from "../lesson-player-context";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { useLessonBuddy } from "./lesson-tutor";
import { useShowsMiss } from "./use-shows-miss";

/** How many of the buddy's suggested questions the aside offers over its composer. */
const SUGGESTED = 2;

/** The aside composer's placeholder, by what the learner would ask about. */
function useDockPlaceholder({ context, name }: { context: LessonQuestionContext; name: string }) {
  const t = useExtracted();

  if (context.kind === "answer") {
    return t("Ask {name} about your answer", { name });
  }

  return t("Ask {name} about this screen", { name });
}

/**
 * The buddy's composer at the foot of the aside, always there beside the lesson: what the learner
 * writes is about the screen in view, and sending it shows the conversation in the aside.
 */
function DockComposer() {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const controller = useLessonQuestionController();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const docked = buddy?.docked ?? false;

  const placeholder = useDockPlaceholder({
    context: buddy?.context ?? { kind: "lesson" },
    name: buddy?.identity.name ?? "",
  });

  // Once the conversation shows in the aside, the learner writes (or sends a ready suggestion)
  // without reaching for the composer.
  useEffect(() => {
    if (docked) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [docked]);

  const { state } = controller;

  // The composer sends about the screen in view, whatever the conversation last opened about.
  const dockController = useMemo<LessonQuestionController>(
    () => ({
      ...controller,
      send: () => {
        const question = state.draft.trim();

        buddy?.ask({
          question,
          suggestion:
            question === state.suggestion?.question ? state.suggestion.suggestion : undefined,
        });

        return Promise.resolve();
      },
    }),
    [buddy, controller, state.draft, state.suggestion],
  );

  if (!buddy) {
    return null;
  }

  return (
    <QuestionComposer
      avatar={buddy.identity.avatar}
      controller={dockController}
      inputRef={inputRef}
      label={t("Ask a question")}
      placeholder={placeholder}
    />
  );
}

/** A visitor or guest sees where the buddy is, and the way to an account that can ask it. */
export function DockSignUp({
  identity,
  navigation,
}: {
  identity: TutorIdentity;
  navigation: LessonQuestionNavigation;
}) {
  const t = useExtracted();
  const { linkComponent: LinkComponent, loginHref } = navigation;

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
        {identity.avatar}
      </span>
      {t("Create a free account to ask questions")}
    </LinkComponent>
  );
}

/** A screen that teaches by reading (an explanation, a worked example, a hook's fact). */
function isTeachingRead(step: PlayableLibraryStep | null): boolean {
  return step !== null && !isLanguageStep(step) && isReadStep(step) && step.kind !== "summary";
}

/**
 * Whether the aside offers two questions over its composer: after a wrong answer, about it; and on
 * a reading screen nothing was asked about yet, the lesson's own (simpler, deeper), the one-tap
 * takes the lesson's reading screens have always had.
 */
function useOffersSuggestions(): boolean {
  const { screen } = useLessonPlayer();
  const { state } = useLessonQuestionController();
  const showsMiss = useShowsMiss();

  if (getQuestionLimit(state)) {
    return false;
  }

  return showsMiss || (isTeachingRead(screen.step) && state.questions.length === 0);
}

/**
 * Two of the buddy's suggested questions for where the learner is, each sent with one tap: about
 * the answer after a wrong one, or the lesson's on a reading screen.
 */
function DockSuggestions() {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const controller = useLessonQuestionController();

  const suggestions = useTutorSuggestions({
    contextKind: buddy?.context.kind ?? "lesson",
    lessonSuggestions: controller.suggestions,
  }).slice(0, SUGGESTED);

  if (!buddy || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={t("Suggested questions")}
      className="bg-background flex flex-wrap gap-2 px-4 pb-3"
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
 * The buddy at the foot of the lesson's aside from `lg`, level with the action bar: its composer
 * (or, for a visitor, the way to an account) and, after a wrong answer or on a reading screen, two
 * suggested questions over it. The aside's content ends where the dock starts.
 */
export function LessonDock() {
  const buddy = useLessonBuddy();
  const { canAskQuestions } = useLessonQuestionController();
  const offersSuggestions = useOffersSuggestions();
  const dockRef = useRef<HTMLDivElement>(null);

  useTaskFootHeight(dockRef, "--task-dock");

  if (!buddy) {
    return null;
  }

  return (
    <LessonQuestionNavigationContext value={buddy.navigation}>
      <div className={TUTOR_DOCK_CLASS} data-slot="lesson-dock" ref={dockRef}>
        {offersSuggestions && canAskQuestions && !buddy.docked && <DockSuggestions />}

        <div className={TUTOR_DOCK_BAR_CLASS}>
          {canAskQuestions ? (
            <DockComposer />
          ) : (
            <DockSignUp identity={buddy.identity} navigation={buddy.navigation} />
          )}
        </div>
      </div>
    </LessonQuestionNavigationContext>
  );
}

/**
 * The way back to the conversation about the screen in view, on the aside's header, once the
 * learner has asked about it: how many questions it holds.
 */
export function ConversationToggle({ fallback }: { fallback?: React.ReactNode }) {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const { state } = useLessonQuestionController();
  const count = state.questions.length;

  if (!buddy || count === 0) {
    return fallback;
  }

  return (
    <button
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring hit-area relative -mr-1 inline-flex items-center gap-0.5 rounded-md px-1 font-sans text-xs font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid"
      onClick={() => buddy.open()}
      type="button"
    >
      {t("{count, plural, one {# question} other {# questions}}", { count })}
      <ChevronRightIcon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

/**
 * The conversation with the buddy docked in the lesson's aside from `lg`, over what the aside
 * showed, with "From the lesson" to go back: the lesson stays beside it, and its keys keep working.
 */
export function DockedConversation() {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const controller = useLessonQuestionController();

  if (!buddy) {
    return null;
  }

  const back = () => {
    buddy.close();
    getLessonFocusTarget()?.focus({ preventScroll: true });
  };

  return (
    <section
      aria-label={t("Questions to {name}", { name: buddy.identity.name })}
      className={DOCKED_CONVERSATION_CLASS}
      data-slot="lesson-docked-conversation"
    >
      <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4 xl:h-15">
        <Button
          className="text-muted-foreground -ml-1 px-2"
          onClick={back}
          size="sm"
          variant="ghost"
        >
          <ChevronLeftIcon aria-hidden="true" />
          {t("From the lesson")}
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

      <LessonQuestionNavigationContext value={buddy.navigation}>
        <div className="min-h-0 flex-1">
          <QuestionThread
            controller={controller}
            identity={buddy.identity}
            isAuthenticated={controller.canAskQuestions}
          />
        </div>
      </LessonQuestionNavigationContext>
    </section>
  );
}
