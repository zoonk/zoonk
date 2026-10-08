"use client";

import {
  type LessonQuestionScreenKind,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { Suspense, lazy, useMemo, useState } from "react";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";

type ScreenTarget = Extract<TutorTarget, { kind: LessonQuestionScreenKind }>;

/** The sheet brings the Markdown renderer with it, so a screen loads it once the learner asks. */
const LessonQuestionSheet = lazy(async () => {
  const panel = await import("./lesson-question-panel");
  return { default: panel.LessonQuestionSheet };
});

function useAskLabel({ kind, name }: { kind: LessonQuestionScreenKind; name: string }) {
  const t = useExtracted();

  switch (kind) {
    case "chapter":
      return t("Ask {name} about this chapter", { name });
    case "mock":
      return t("Ask {name} about this mock exam", { name });
    case "plan":
      return t("Ask {name} about your plan", { name });
    default:
      return kind satisfies never;
  }
}

/** The button's size: small beside a screen's content, the bar's size in a page's top bar. */
type AskTutorSize = "bar" | "sm";

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

  return (
    <Button
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
      {t("Ask {name}", { name: identity.name })}
    </Button>
  );
}

/** The sheet mounts the first time it opens and stays for its closing animation after that. */
function ScreenTutorSheet({
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
      <LessonQuestionSheet identity={identity} navigation={navigation} />
    </Suspense>
  );
}

/**
 * The questions sheet of a screen outside the player (a chapter or a finished mock), mounted with
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
      <ScreenTutorSheet identity={identity} navigation={tutor.navigation} />
    </LessonQuestionHostProvider>
  );
}

/**
 * "Ask Zu" on a screen outside the player: the same questions sheet as in a lesson, where the
 * learner's buddy answers about what the screen shows, with suggested questions. Its thread loads
 * when the learner opens it.
 *
 * ```tsx
 * <AskTutor target={chapterTarget} tutor={tutorConfig} />
 * ```
 */
export function AskTutor({
  size = "sm",
  target,
  tutor,
}: {
  size?: AskTutorSize;
  target: ScreenTarget;
  tutor: LessonTutorConfig;
}) {
  const identity = useTutorIdentity(tutor.buddy);

  return (
    <AskTutorProvider identity={identity} target={target} tutor={tutor}>
      <AskTutorButton identity={identity} kind={target.kind} size={size} />
    </AskTutorProvider>
  );
}
