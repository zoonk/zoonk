"use client";

import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { TUTOR_COMPOSER_FRAME_CLASS } from "@zoonk/learn/tutor-composer";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { QuestionComposer } from "./lesson-question-composer";
import {
  LessonQuestionNavigationContext,
  useLessonQuestionNavigation,
} from "./lesson-question-navigation";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { ConversationLog, type ConversationLogProps } from "./tutor-conversation-log";
import { useConversationMissionMoment } from "./tutor-mission-moment";
import { TutorSuggestions, useOffersSuggestions } from "./tutor-suggestions";
import { type LessonQuestionThreadPage } from "./use-lesson-question-sessions";
import { type LessonQuestionHost } from "./use-lesson-questions";
import { useTurnSignals } from "./use-turn-signals";

type TutorConversationProps = ConversationLogProps & {
  composerLabel: string;
  /** Only seeds the composer; the learner must send it explicitly. */
  draft?: string;
  onAnswered?: () => void;
  onAsked?: () => void;
  placeholder: string;
  suggestions: readonly { id: string; label: string }[];
};

const COMPOSER_POSITION =
  "sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] lg:bottom-0 z-10 -mx-4 bg-linear-to-t from-background from-75% to-transparent px-4 pt-6 pb-3 lg:pb-6";

function SignUpPrompt() {
  const t = useExtracted();
  const { loginHref } = useLessonQuestionNavigation();

  return (
    <div
      className={cn(
        TUTOR_COMPOSER_FRAME_CLASS,
        "flex min-h-11 items-center gap-3 py-1.75 pr-1.75 pl-3",
      )}
    >
      <p className="text-muted-foreground flex-1 text-sm">
        {t("Create a free account to start the conversation.")}
      </p>
      <a className={buttonVariants({ size: "sm" })} href={loginHref}>
        {t("Create a free account")}
      </a>
    </div>
  );
}

function useBroughtQuestion({
  changeDraft,
  draft,
}: {
  changeDraft: (draft: string) => void;
  draft?: string;
}) {
  useEffect(() => {
    if (draft) {
      changeDraft(draft);
    }
  }, [changeDraft, draft]);
}

function ConversationBody({
  composerLabel,
  conversationId,
  draft,
  greeting,
  greetingAction,
  identity,
  missionMoment,
  onAnswered,
  onAsked,
  placeholder,
  renderPlanChange,
  renderToolOffer,
  suggestions,
}: TutorConversationProps & { conversationId: string; missionMoment: MissionMomentView | null }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const { canAskQuestions, load, state } = controller;
  const ready = state.loadStatus === "ready" && state.error !== "load";
  const empty = ready && state.questions.length === 0;
  const offersSuggestions = useOffersSuggestions();
  const waiting = canAskQuestions && state.loadStatus === "idle" && state.error !== "load";

  useEffect(() => {
    if (waiting) {
      void load();
    }
  }, [load, waiting]);

  useBroughtQuestion({ changeDraft: controller.changeDraft, draft });
  useTurnSignals({ onAnswered, onAsked });

  return (
    <section
      aria-label={t("Conversation with {name}", { name: identity.name })}
      className="flex flex-1 flex-col"
    >
      <ConversationLog
        greeting={greeting}
        greetingAction={greetingAction}
        identity={identity}
        key={conversationId}
        missionMoment={missionMoment}
        renderPlanChange={renderPlanChange}
        renderToolOffer={renderToolOffer}
      />

      <div className={cn(COMPOSER_POSITION, "flex flex-col gap-3")}>
        {empty && canAskQuestions && offersSuggestions && (
          <TutorSuggestions
            onSelect={(suggestion) => void controller.sendSuggestion(suggestion)}
            suggestions={suggestions.map(({ label }) => ({ question: label }))}
          />
        )}

        {canAskQuestions ? (
          <QuestionComposer
            controller={controller}
            label={composerLabel}
            placeholder={placeholder}
            variant="page"
          />
        ) : (
          <SignUpPrompt />
        )}
      </div>
    </section>
  );
}

/**
 * One goal's conversations with the buddy, showing the one `conversationId` names. Each keeps its
 * own turns, draft, answer on its way and unsent question, so opening another never moves them
 * across, and coming back finds them. `thread` is what the page read of the open one: the first is
 * there from the first paint, with nothing arriving after it.
 */
export function TutorConversation({
  conversationId,
  goalId,
  onMissionMoment,
  onQuestionSaved,
  thread,
  tutor,
  ...props
}: TutorConversationProps & {
  conversationId: string;
  goalId: string;
  onMissionMoment?: (moment: MissionMomentView) => void;
  onQuestionSaved?: (saved: { conversationId: string; question: LessonQuestionResource }) => void;
  thread: LessonQuestionThreadPage | null;
  tutor: LessonTutorConfig;
}) {
  const target = useMemo(
    () => ({ conversationId, goalId, kind: "plan" as const }),
    [conversationId, goalId],
  );

  const context = useMemo(() => ({ conversationId, kind: "plan" as const }), [conversationId]);
  const missionMoment = useConversationMissionMoment({ conversationId, onMoment: onMissionMoment });
  const onSaved = useRef(onQuestionSaved);

  useEffect(() => {
    onSaved.current = onQuestionSaved;
  }, [onQuestionSaved]);

  const reportSaved = useCallback<NonNullable<LessonQuestionHost["onQuestionSaved"]>>(
    ({ context: asked, question }) => {
      if (asked.kind === "plan") {
        onSaved.current?.({ conversationId: asked.conversationId, question });
      }
    },
    [],
  );

  const host = useMemo<LessonQuestionHost>(
    () => ({
      activeContext: context,
      canAskQuestions: tutor.canAsk,
      initialThread: thread,
      lessonStepIds: [],
      onMissionMoment: missionMoment.receive,
      onQuestionSaved: reportSaved,
      page: true,
      preload: false,
    }),
    [context, missionMoment.receive, reportSaved, thread, tutor.canAsk],
  );

  return (
    <LessonQuestionNavigationContext value={tutor.navigation}>
      <LessonQuestionHostProvider
        connection={tutor.connection}
        host={host}
        key={goalId}
        target={target}
      >
        <ConversationBody
          {...props}
          conversationId={conversationId}
          missionMoment={missionMoment.moment}
        />
      </LessonQuestionHostProvider>
    </LessonQuestionNavigationContext>
  );
}
