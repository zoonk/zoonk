"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { DockSignUp } from "../lesson/tutor/lesson-dock";
import { useItemBuddy } from "./item-tutor";
import { QuestionComposer } from "./lesson-question-composer";
import { getQuestionLimit } from "./lesson-question-errors";
import { LessonQuestionNavigationContext } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { QuestionThread } from "./lesson-question-thread";
import {
  DOCKED_CONVERSATION_CLASS,
  TUTOR_DOCK_BAR_CLASS,
  TUTOR_DOCK_CLASS,
  useAsideBottom,
} from "./tutor-dock-layout";
import { type LessonQuestionController } from "./use-lesson-questions";
import { useTutorSuggestions } from "./use-tutor-suggestions";

/** How many of the buddy's suggested questions the aside offers over its composer. */
const SUGGESTED = 2;

/**
 * The buddy's composer at the foot of the aside: what the learner writes is about the question in
 * view, and sending it shows the conversation in the aside.
 */
function ItemDockComposer() {
  const t = useExtracted();
  const buddy = useItemBuddy();
  const controller = useLessonQuestionController();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const docked = buddy?.docked ?? false;
  const { state } = controller;

  // Once the conversation shows in the aside, the learner writes without reaching for the field.
  useEffect(() => {
    if (docked) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [docked]);

  // The composer sends about the question in view, whatever the conversation last opened about.
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
      placeholder={
        buddy.item.answered
          ? t("Ask {name} about your answer", { name: buddy.identity.name })
          : t("Ask {name} about this question", { name: buddy.identity.name })
      }
    />
  );
}

/** After a missed answer, before anything was asked about it: two questions to send in one tap. */
function ItemDockSuggestions() {
  const t = useExtracted();
  const buddy = useItemBuddy();
  const controller = useLessonQuestionController();

  const suggestions = useTutorSuggestions({
    answered: buddy?.item.answered,
    contextKind: "item",
    lessonSuggestions: [],
  });

  const { state } = controller;

  if (
    !buddy?.item.missed ||
    buddy.docked ||
    state.questions.length > 0 ||
    getQuestionLimit(state) ||
    !controller.canAskQuestions
  ) {
    return null;
  }

  return (
    <div
      aria-label={t("Suggested questions")}
      className="bg-background flex flex-wrap gap-2 px-6 pb-3"
      role="group"
    >
      {suggestions.slice(0, SUGGESTED).map((suggestion) => (
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

/** The conversation docked over the aside from `lg`, with the way back to what the aside showed. */
function ItemDockedConversation() {
  const t = useExtracted();
  const buddy = useItemBuddy();
  const controller = useLessonQuestionController();

  if (!buddy?.docked) {
    return null;
  }

  return (
    <section
      aria-label={t("Questions to {name}", { name: buddy.identity.name })}
      className={DOCKED_CONVERSATION_CLASS}
      data-slot="item-docked-conversation"
    >
      <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4 xl:h-15">
        <Button
          className="text-muted-foreground -ml-1 px-2"
          onClick={buddy.close}
          size="sm"
          variant="ghost"
        >
          <ChevronLeftIcon aria-hidden="true" />
          {t("Back")}
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
        <QuestionThread
          controller={controller}
          identity={buddy.identity}
          isAuthenticated={controller.canAskQuestions}
        />
      </div>
    </section>
  );
}

/**
 * The buddy in a run's aside from `lg` (a session's block, mistakes practice), beside the question:
 * its composer at the foot, level with the action bar (for a visitor, the way to an account), two
 * suggested questions over it after a missed answer, and the conversation over the aside once the
 * learner asks.
 */
export function ItemTutorAside() {
  const buddy = useItemBuddy();
  const { canAskQuestions } = useLessonQuestionController();
  const dockRef = useRef<HTMLDivElement>(null);

  useAsideBottom(dockRef);

  if (!buddy) {
    return null;
  }

  return (
    <LessonQuestionNavigationContext value={buddy.navigation}>
      <ItemDockedConversation />

      <div className={TUTOR_DOCK_CLASS} data-slot="item-dock" ref={dockRef}>
        <ItemDockSuggestions />

        <div className={TUTOR_DOCK_BAR_CLASS}>
          {canAskQuestions ? (
            <ItemDockComposer />
          ) : (
            <DockSignUp identity={buddy.identity} navigation={buddy.navigation} />
          )}
        </div>
      </div>
    </LessonQuestionNavigationContext>
  );
}
