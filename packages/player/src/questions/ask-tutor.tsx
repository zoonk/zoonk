"use client";

import {
  type LessonQuestionScreenKind,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { Button } from "@zoonk/ui/components/button";
import { MessageCircleQuestionIcon } from "lucide-react";
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

function useAskLabel(kind: LessonQuestionScreenKind) {
  const t = useExtracted();

  switch (kind) {
    case "chapter":
      return t("Ask about this chapter");
    case "mock":
      return t("Ask about this mock exam");
    case "plan":
      return t("Ask about your plan");
    default:
      return kind satisfies never;
  }
}

function AskTutorButton({ kind }: { kind: LessonQuestionScreenKind }) {
  const t = useExtracted();
  const { open } = useLessonQuestionController();
  const label = useAskLabel(kind);

  return (
    <Button
      aria-label={label}
      className="in-data-[mode=fun]:fun-glass in-data-[mode=fun]:border-transparent"
      onClick={() => open({ kind })}
      size="sm"
      type="button"
      variant="outline"
    >
      <MessageCircleQuestionIcon aria-hidden="true" />
      {t("Ask")}
    </Button>
  );
}

/** The sheet mounts the first time it opens and stays for its closing animation after that. */
function ScreenTutorSheet({ navigation }: { navigation: LessonTutorConfig["navigation"] }) {
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
      <LessonQuestionSheet navigation={navigation} stepCount={0} />
    </Suspense>
  );
}

/**
 * "Ask" on a screen outside the player (a chapter, the learner's plan or a finished mock): the
 * same questions sheet as the lesson tutor, with suggested questions, about what the screen shows.
 * Its thread loads when the learner opens it.
 *
 * Keep `target` and `tutor` stable across renders, as the tutor's requests follow them.
 *
 * ```tsx
 * <AskTutor target={chapterTarget} tutor={tutorConfig} />
 * ```
 */
export function AskTutor({ target, tutor }: { target: ScreenTarget; tutor: LessonTutorConfig }) {
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
      <AskTutorButton kind={target.kind} />
      <ScreenTutorSheet navigation={tutor.navigation} />
    </LessonQuestionHostProvider>
  );
}
