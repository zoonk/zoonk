"use client";

import {
  type LessonQuestionScreenKind,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { ListRowButton, ListRowContent, ListRowLeading, ListRowTitle } from "@zoonk/learn/list";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MessageCircleQuestionIcon } from "lucide-react";
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

const LessonQuestionDrawer = lazy(async () => {
  const panel = await loadDrawer();
  return { default: panel.LessonQuestionDrawer };
});

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

type AskTutorSize = "bar" | "sm" | "task";

const TASK_ASK_CLASS = cn(
  "size-11 shrink-0 px-0 lg:w-auto lg:px-4 lg:pl-2",
  "lg:group-data-aside/task:fixed lg:group-data-aside/task:right-5 lg:group-data-aside/task:bottom-[max(1rem,env(safe-area-inset-bottom))] lg:group-data-aside/task:w-[calc(var(--task-aside)-2.5rem-1px)] lg:group-data-aside/task:justify-start",
);

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
        <MessageCircleQuestionIcon aria-hidden="true" className="lg:hidden" />
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center *:size-6! max-lg:hidden"
        >
          {identity.avatar}
        </span>
        <span className="truncate max-lg:hidden">{name}</span>
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

/** Keep `target` and `tutor` stable across renders because requests follow their identity. */
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
