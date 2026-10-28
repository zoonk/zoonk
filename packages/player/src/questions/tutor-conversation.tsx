"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type TutorCards } from "@zoonk/learn/tutor-cards";
import { TUTOR_COMPOSER_FRAME_CLASS } from "@zoonk/learn/tutor-composer";
import { type TutorIdentity, TutorMessage } from "@zoonk/learn/tutor-identity";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "../activities/_utils/use-reduced-motion";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { QuestionComposer } from "./lesson-question-composer";
import {
  QuestionErrorAction,
  QuestionLimitNotice,
  RequestErrorMessage,
  toHelpLimit,
} from "./lesson-question-errors";
import {
  LessonQuestionNavigationContext,
  useLessonQuestionNavigation,
} from "./lesson-question-navigation";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { EarlierTurns, QuestionTurn } from "./lesson-question-turn";
import {
  ConversationSkeleton,
  FirstDay,
  Suggestions,
  TurnDay,
  type TutorSuggestion,
} from "./tutor-conversation-parts";
import { ConversationMissionMoment, useConversationMissionMoment } from "./tutor-mission-moment";
import { type LessonQuestionThreadPage } from "./use-lesson-question-sessions";
import { type LessonQuestionHost } from "./use-lesson-questions";
import { useTurnSignals } from "./use-turn-signals";

/**
 * The conversation draws the cards under the buddy's answers as the host says (`getTutorCards`):
 * a plan change it proposed, telling the conversation how the learner answered, and an app tool.
 */
type TutorConversationProps = TutorCards & {
  /** What the composer is called for screen readers, such as "Message Zu". */
  composerLabel: string;
  /**
   * A question the learner brought from elsewhere (search's "Ask Buddy: …"): it waits in the
   * composer for their own send, and is never sent for them.
   */
  draft?: string;
  /** The tutor's hello, always the conversation's first message. */
  greeting: string;
  /** One action under the hello, such as picking a buddy before there's one. */
  greetingAction?: React.ReactNode;
  identity: TutorIdentity;
  /** An answer the learner waited for came in, so the host's buddy can react to it. */
  onAnswered?: () => void;
  /** The learner asked something, so the host's buddy can react to it. */
  onAsked?: () => void;
  placeholder: string;
  /** Up to three questions the learner can send with one tap before the first message. */
  suggestions: readonly TutorSuggestion[];
};

const GOAL_CONTEXT = { kind: "plan" } as const;

/**
 * The composer is always at the bottom of the screen, however short the conversation: under `lg`
 * right above the tab bar (4rem tall plus its border and the home indicator), from `lg` at the
 * screen's bottom edge.
 */
const COMPOSER_POSITION =
  "sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] lg:bottom-0 z-10 -mx-4 bg-linear-to-t from-background from-75% to-transparent px-4 pt-6 pb-3 lg:pb-6";

/** The conversation couldn't be read: why, and the one thing to do (try again, or what a limit asks). */
function LoadError() {
  const controller = useLessonQuestionController();
  const error = controller.state.requestError;
  const limit = toHelpLimit(error);

  if (limit) {
    return <QuestionLimitNotice limit={limit} />;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">
        <RequestErrorMessage error={error} />
      </p>
      <QuestionErrorAction error={error} onRetry={() => void controller.load()} />
    </div>
  );
}

/**
 * In the composer's place for guests and visitors: where they'd type, the way to an account that
 * lets them.
 */
function SignUpPrompt() {
  const t = useExtracted();
  const { linkComponent: Link, loginHref } = useLessonQuestionNavigation();

  return (
    <div className={cn(TUTOR_COMPOSER_FRAME_CLASS, "flex items-center gap-3 py-2 pr-2 pl-3.5")}>
      <p className="text-muted-foreground flex-1 text-sm">
        {t("Create a free account to start the conversation.")}
      </p>
      <Link className={buttonVariants({ size: "sm" })} href={loginHref} prefetch={false}>
        {t("Create a free account")}
      </Link>
    </div>
  );
}

/**
 * A question the learner just sent moves to the top, so its answer has the room to come in under
 * it; the latest exchange is in view when the conversation opens.
 */
function useFollowLatest({ latestId, ready }: { latestId: string | null; ready: boolean }) {
  const reducedMotion = useReducedMotion();
  const turns = useRef(new Map<string, HTMLElement>());
  const shown = useRef<{ id: string | null } | null>(null);

  useEffect(() => {
    if (!ready || (shown.current && shown.current.id === latestId)) {
      return;
    }

    const opening = shown.current === null;
    shown.current = { id: latestId };
    const turn = latestId ? turns.current.get(latestId) : null;

    turn?.scrollIntoView({
      behavior: opening || reducedMotion ? "instant" : "smooth",
      block: "start",
    });
  }, [latestId, ready, reducedMotion]);

  return (id: string) => (element: HTMLElement | null) => {
    if (element) {
      turns.current.set(id, element);
    } else {
      turns.current.delete(id);
    }
  };
}

function ConversationTurns({
  identity,
  renderPlanChange,
  renderToolOffer,
}: Pick<TutorConversationProps, "identity" | "renderPlanChange" | "renderToolOffer">) {
  const controller = useLessonQuestionController();
  const { state } = controller;
  const latestId = state.questions.at(-1)?.id ?? null;
  const trackTurn = useFollowLatest({ latestId, ready: state.loadStatus === "ready" });

  return (
    <>
      <EarlierTurns page />

      {state.questions.map((question, index) => (
        <div
          className="flex scroll-mt-4 flex-col gap-5 lg:scroll-mt-24"
          key={question.id}
          ref={trackTurn(question.id)}
        >
          <TurnDay
            date={new Date(question.createdAt)}
            previous={index > 0 ? new Date(state.questions[index - 1]?.createdAt ?? 0) : null}
          />
          <QuestionTurn
            identity={identity}
            page
            planChange={
              question.planChange &&
              renderPlanChange({
                change: question.planChange,
                onAnswered: controller.answerPlanChange,
              })
            }
            question={question}
            toolOffer={question.toolOffer && renderToolOffer(question.toolOffer)}
          />
        </div>
      ))}
    </>
  );
}

/** Puts a question brought from elsewhere in the composer, once for each question brought. */
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
  draft,
  greeting,
  greetingAction,
  identity,
  onAnswered,
  onAsked,
  placeholder,
  renderPlanChange,
  missionMoment,
  renderToolOffer,
  suggestions,
}: TutorConversationProps & { missionMoment: MissionMomentView | null }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const { canAskQuestions, state } = controller;
  const ready = state.loadStatus === "ready" && state.error !== "load";
  const empty = ready && state.questions.length === 0;

  const answering = state.questions.some((question) => isLessonQuestionAnswerInProgress(question));

  useBroughtQuestion({ changeDraft: controller.changeDraft, draft });
  useTurnSignals({ onAnswered, onAsked });

  return (
    <section
      aria-label={t("Conversation with {name}", { name: identity.name })}
      className="flex flex-1 flex-col"
    >
      <div aria-busy={answering} className="flex flex-1 flex-col gap-5 pb-2" role="log">
        <FirstDay />

        <TutorMessage identity={identity} page>
          <p>{greeting}</p>
          {greetingAction && <div className="flex">{greetingAction}</div>}
        </TutorMessage>

        {canAskQuestions && state.loadStatus !== "ready" && <ConversationSkeleton />}

        {state.error === "load" && <LoadError />}

        {ready && (
          <ConversationTurns
            identity={identity}
            renderPlanChange={renderPlanChange}
            renderToolOffer={renderToolOffer}
          />
        )}

        <ConversationMissionMoment buddyName={identity.name} moment={missionMoment} />
      </div>

      <div className={cn(COMPOSER_POSITION, "flex flex-col gap-2.5")}>
        {empty && canAskQuestions && (
          <Suggestions
            onSend={(question) => void controller.sendSuggestion({ question })}
            suggestions={suggestions}
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
 * The learner's conversation with their tutor about one goal, as a page: the tutor's hello, their
 * messages and its answers (with the plan changes it proposed and the app tools it offered, drawn
 * by the host), a few
 * suggestions to start, and a composer that stays within reach. Signed-in learners talk;
 * visitors and guests are asked to create an account. It's the same tutor as the lesson's, over
 * the goal's thread in the public API.
 *
 * ```tsx
 * <TutorConversation goalId={goal.id} identity={{ avatar, name: "Zu" }} tutor={tutor} ... />
 * ```
 *
 * A host that read the thread on the server passes it as `initialThread`: the conversation shows
 * at once, without reading it again from the browser. Its page is read again as a whole when it
 * may be old (a new navigation, the tab shown again later).
 */
export function TutorConversation({
  goalId,
  initialThread = null,
  onMissionMoment,
  tutor,
  ...props
}: TutorConversationProps & {
  goalId: string;
  initialThread?: LessonQuestionThreadPage | null;
  /** A question completed one of the day's missions, so the host can read its day again. */
  onMissionMoment?: (moment: MissionMomentView) => void;
  tutor: LessonTutorConfig;
}) {
  const target = useMemo(() => ({ goalId, kind: "plan" as const }), [goalId]);
  const missionMoment = useConversationMissionMoment({ goalId, onMoment: onMissionMoment });

  const host = useMemo<LessonQuestionHost>(
    () => ({
      activeContext: GOAL_CONTEXT,
      canAskQuestions: tutor.canAsk,
      initialThread,
      lessonStepIds: [],
      onMissionMoment: missionMoment.receive,
      page: true,
      preload: !initialThread,
    }),
    [initialThread, missionMoment.receive, tutor.canAsk],
  );

  // Each goal has its own thread: another goal starts its conversation from its own history.
  return (
    <LessonQuestionNavigationContext value={tutor.navigation}>
      <LessonQuestionHostProvider
        connection={tutor.connection}
        host={host}
        key={goalId}
        target={target}
      >
        <ConversationBody {...props} missionMoment={missionMoment.moment} />
      </LessonQuestionHostProvider>
    </LessonQuestionNavigationContext>
  );
}
