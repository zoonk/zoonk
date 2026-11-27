"use client";

import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { TUTOR_COMPOSER_FRAME_CLASS } from "@zoonk/learn/tutor-composer";
import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
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
import { ConversationHostContext, type OpenConversation } from "./tutor-conversation-host";
import { useConversationMissionMoment } from "./tutor-mission-moment";
import { TutorSuggestions, useOffersSuggestions } from "./tutor-suggestions";
import { type LessonQuestionHost } from "./use-lesson-questions";
import { useTurnSignals } from "./use-turn-signals";

export { TutorConversationLog } from "./tutor-conversation-log";

type ConversationFrameProps = {
  composerLabel: string;
  /** Only seeds the composer; the learner must send it explicitly. */
  draft?: string;
  identity: TutorIdentity;
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

function ConversationFrame({
  blank,
  children,
  composerLabel,
  draft,
  identity,
  onAnswered,
  onAsked,
  placeholder,
  suggestions,
}: ConversationFrameProps & { blank: boolean; children: React.ReactNode }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const { canAskQuestions, state } = controller;
  const ready = state.loadStatus === "ready" && state.error !== "load";
  const empty = (blank || ready) && state.questions.length === 0;
  const offersSuggestions = useOffersSuggestions();

  useBroughtQuestion({ changeDraft: controller.changeDraft, draft });
  useTurnSignals({ onAnswered, onAsked });

  return (
    <section
      aria-label={t("Conversation with {name}", { name: identity.name })}
      className="flex flex-1 flex-col"
    >
      {children}

      <div className={cn(COMPOSER_POSITION, "flex flex-col gap-2.5")}>
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
 * One goal's conversations with the buddy: it keeps each one's turns, draft, answer on its way and
 * unsent question apart, by conversation, and draws the composer for the open one. `children` is
 * that conversation's `TutorConversationLog`.
 */
export function TutorConversationHost({
  children,
  conversation,
  goalId,
  onMissionMoment,
  onQuestionSaved,
  tutor,
  ...props
}: ConversationFrameProps & {
  children: React.ReactNode;
  conversation: OpenConversation;
  goalId: string;
  onMissionMoment?: (moment: MissionMomentView) => void;
  onQuestionSaved?: (saved: { conversationId: string; question: LessonQuestionResource }) => void;
  tutor: LessonTutorConfig;
}) {
  const { blank, id } = conversation;

  const target = useMemo(
    () => ({ conversationId: id, goalId, kind: "plan" as const }),
    [goalId, id],
  );

  const context = useMemo(() => ({ conversationId: id, kind: "plan" as const }), [id]);

  const missionMoment = useConversationMissionMoment({
    conversationId: id,
    onMoment: onMissionMoment,
  });

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
      lessonStepIds: [],
      onMissionMoment: missionMoment.receive,
      onQuestionSaved: reportSaved,
      page: true,
      preload: false,
    }),
    [context, missionMoment.receive, reportSaved, tutor.canAsk],
  );

  const open = useMemo(
    () => ({ blank, id, missionMoment: missionMoment.moment }),
    [blank, id, missionMoment.moment],
  );

  return (
    <LessonQuestionNavigationContext value={tutor.navigation}>
      <LessonQuestionHostProvider
        connection={tutor.connection}
        host={host}
        key={goalId}
        target={target}
      >
        <ConversationHostContext value={open}>
          <ConversationFrame {...props} blank={blank}>
            {children}
          </ConversationFrame>
        </ConversationHostContext>
      </LessonQuestionHostProvider>
    </LessonQuestionNavigationContext>
  );
}
