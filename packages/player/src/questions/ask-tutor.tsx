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

type ScreenTarget = Extract<TutorTarget, { kind: LessonQuestionScreenKind }>;

/** The drawer brings the Markdown renderer with it, so a screen loads it once the learner asks. */
const LessonQuestionDrawer = lazy(async () => {
  const panel = await import("./lesson-question-panel");
  return { default: panel.LessonQuestionDrawer };
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
    case "subject":
      return t("Ask {name} about this subject", { name });
    default:
      return kind satisfies never;
  }
}

/**
 * The button's size: small beside a screen's content, the bar's size in a page's top bar, and in
 * a task's header (a mock's result) small with its name only from `sm`: on a phone the buddy's
 * face alone, as wide as the close button across, so the header's title between stays clear.
 */
type AskTutorSize = "bar" | "sm" | "task";

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
    <ListRowButton onClick={() => open({ kind })}>
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

  const inTask = size === "task";

  return (
    <Button
      aria-label={label}
      className={cn("pl-1.5", inTask && "max-sm:size-9 max-sm:px-0")}
      onClick={() => open({ kind })}
      size={inTask ? "sm" : size}
      type="button"
      variant="outline"
    >
      <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
        {identity.avatar}
      </span>
      <span className={cn(inTask && "max-sm:hidden")}>
        {t("Ask {name}", { name: identity.name })}
      </span>
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
