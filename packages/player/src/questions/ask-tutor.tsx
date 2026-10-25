"use client";

import {
  type LessonQuestionScreenKind,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { ListRowButton, ListRowContent, ListRowLeading, ListRowTitle } from "@zoonk/learn/list";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Suspense, lazy, useMemo, useState } from "react";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { preloadTutorMarkdown } from "./tutor-markdown-preload";

type ScreenTarget = Extract<TutorTarget, { kind: LessonQuestionScreenKind }>;

const loadDrawer = () => import("./lesson-question-panel");

/** A screen loads the drawer once the learner asks, and the answers' renderer with it. */
const LessonQuestionDrawer = lazy(async () => {
  const panel = await loadDrawer();
  return { default: panel.LessonQuestionDrawer };
});

/**
 * Pointing at "Ask" (or focusing it, or pressing it) starts loading the drawer and the answers'
 * renderer, so the conversation opens without waiting for them.
 */
function preloadDrawer() {
  loadDrawer().catch(() => null);
  preloadTutorMarkdown();
}

const PRELOAD_ON_INTENT = {
  onFocus: preloadDrawer,
  onPointerDown: preloadDrawer,
  onPointerEnter: preloadDrawer,
};

function useAskLabel({ kind, name }: { kind: LessonQuestionScreenKind; name: string }) {
  const t = useExtracted();

  switch (kind) {
    case "chapter":
      return t("Ask {name} about this chapter", { name });
    case "mock":
      return t("Ask {name} about this mock exam", { name });
    case "plan":
      return t("Ask {name} about your plan", { name });
    case "subject":
      return t("Ask {name} about this subject", { name });
    default:
      return kind satisfies never;
  }
}

/**
 * The button's size: small beside a screen's content, the bar's size in a page's top bar, and in
 * a task (a mock's result) where every task has its buddy: the buddy's face alone after the main
 * action on a phone and a tablet, and from `lg` at the foot of the task's aside, in the action
 * bar's row, saying what it asks about, as the composer does there on other tasks (in the bar,
 * with its name, when the task has no aside).
 */
type AskTutorSize = "bar" | "sm" | "task";

/** A task's buddy (`task`): see `AskTutorSize`. */
const TASK_ASK_CLASS = cn(
  "size-11 shrink-0 px-0 lg:w-auto lg:px-4 lg:pl-2",
  "lg:group-data-aside/task:fixed lg:group-data-aside/task:right-[calc(var(--task-margin)+1rem)] lg:group-data-aside/task:bottom-[max(1rem,env(safe-area-inset-bottom))] lg:group-data-aside/task:w-[calc(var(--task-aside)-2rem)] lg:group-data-aside/task:justify-start",
);

/**
 * "Ask Zu about this subject" as a row of a page's list (its aside's "Also"), by the buddy's face:
 * the same drawer as the bar's button.
 */
function AskTutorRow({
  identity,
  kind,
}: {
  identity: TutorIdentity;
  kind: LessonQuestionScreenKind;
}) {
  const { open } = useLessonQuestionController();
  const label = useAskLabel({ kind, name: identity.name });

  return (
    <ListRowButton {...PRELOAD_ON_INTENT} onClick={() => open({ kind })}>
      <ListRowLeading>
        <span aria-hidden="true" className="flex size-5 items-center justify-center *:size-5!">
          {identity.avatar}
        </span>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{label}</ListRowTitle>
      </ListRowContent>
    </ListRowButton>
  );
}

/** "Ask Zu": the learner's buddy, by face and name, answers about what the screen shows. */
function AskTutorButton({
  identity,
  kind,
  size,
}: {
  identity: TutorIdentity;
  kind: LessonQuestionScreenKind;
  size: AskTutorSize;
}) {
  const t = useExtracted();
  const { open } = useLessonQuestionController();
  const label = useAskLabel({ kind, name: identity.name });

  const name = t("Ask {name}", { name: identity.name });

  if (size === "task") {
    return (
      <Button
        {...PRELOAD_ON_INTENT}
        aria-label={label}
        className={TASK_ASK_CLASS}
        onClick={() => open({ kind })}
        size="xl"
        type="button"
        variant="outline"
      >
        <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
          {identity.avatar}
        </span>
        <span className="max-lg:hidden lg:group-data-aside/task:hidden">{name}</span>
        <span className="hidden truncate lg:group-data-aside/task:inline">{label}</span>
      </Button>
    );
  }

  return (
    <Button
      {...PRELOAD_ON_INTENT}
      aria-label={label}
      className="pl-1.5"
      onClick={() => open({ kind })}
      size={size}
      type="button"
      variant="outline"
    >
      <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
        {identity.avatar}
      </span>
      {name}
    </Button>
  );
}

/** The drawer mounts the first time it opens and stays for its closing animation after that. */
function ScreenTutorDrawer({
  identity,
  navigation,
}: {
  identity: TutorIdentity;
  navigation: LessonTutorConfig["navigation"];
}) {
  const { state } = useLessonQuestionController();
  const [opened, setOpened] = useState(false);

  if (state.isOpen && !opened) {
    setOpened(true);
  }

  if (!opened) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LessonQuestionDrawer identity={identity} navigation={navigation} open={state.isOpen} />
    </Suspense>
  );
}

/**
 * The questions drawer of a screen outside the player (a chapter, a subject or a finished mock), mounted with
 * its "Ask {name}" button. Keep `target` and `tutor` stable across renders, as the tutor's requests
 * follow them.
 */
function AskTutorProvider({
  children,
  identity,
  target,
  tutor,
}: {
  children: React.ReactNode;
  identity: TutorIdentity;
  target: ScreenTarget;
  tutor: LessonTutorConfig;
}) {
  const host = useMemo(
    () => ({
      activeContext: { kind: target.kind },
      canAskQuestions: tutor.canAsk,
      lessonStepIds: [],
      preload: false,
    }),
    [target.kind, tutor.canAsk],
  );

  return (
    <LessonQuestionHostProvider connection={tutor.connection} host={host} target={target}>
      {children}
      <ScreenTutorDrawer identity={identity} navigation={tutor.navigation} />
    </LessonQuestionHostProvider>
  );
}

/**
 * "Ask Zu" on a screen outside the player: the same questions drawer as in a lesson, where the
 * learner's buddy answers about what the screen shows, with suggested questions. Its thread loads
 * when the learner opens it, and only what the learner sends is answered. As a `row` it's a list
 * row saying what it asks about, for a page's aside.
 *
 * ```tsx
 * <AskTutor target={chapterTarget} tutor={tutorConfig} />
 * ```
 */
export function AskTutor({
  appearance = "button",
  size = "sm",
  target,
  tutor,
}: {
  appearance?: "button" | "row";
  size?: AskTutorSize;
  target: ScreenTarget;
  tutor: LessonTutorConfig;
}) {
  const identity = useTutorIdentity(tutor.buddy);

  return (
    <AskTutorProvider identity={identity} target={target} tutor={tutor}>
      {appearance === "row" ? (
        <AskTutorRow identity={identity} kind={target.kind} />
      ) : (
        <AskTutorButton identity={identity} kind={target.kind} size={size} />
      )}
    </AskTutorProvider>
  );
}
