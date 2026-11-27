"use client";

import {
  type LessonQuestionScreenKind,
  type TutorTarget,
} from "@zoonk/core/lesson-questions/contract";
import { ListRowButton, ListRowContent, ListRowLeading, ListRowTitle } from "@zoonk/learn/list";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button } from "@zoonk/ui/components/button";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { createContext, use, useMemo, useState } from "react";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { AskTutorFace } from "./ask-tutor-face";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { ModuleSubjectContext, useModuleSubject } from "./module-subject";
import { preloadTutorMarkdown } from "./tutor-markdown-preload";

/** The plan's conversations are the buddy's page, never a drawer over another screen. */
type ScreenKind = Exclude<LessonQuestionScreenKind, "plan">;

type ScreenTarget = Extract<TutorTarget, { kind: ScreenKind }>;

const questionPanel = createOnDemand(() => import("./lesson-question-panel"));

function preloadDrawer() {
  void questionPanel.load();
  preloadTutorMarkdown();
}

function useOpenDrawer(kind: ScreenKind) {
  const { open } = useLessonQuestionController();

  return () => {
    void questionPanel.load();
    open({ kind });
  };
}

const PRELOAD_ON_INTENT = {
  onFocus: preloadDrawer,
  onPointerDown: preloadDrawer,
  onPointerEnter: preloadDrawer,
};

function useAskLabel({ kind, name }: { kind: ScreenKind; name: string }) {
  const t = useExtracted();
  const isModule = useModuleSubject();

  switch (kind) {
    case "chapter":
      return t("Ask {name} about this chapter", { name });
    case "mock":
      return t("Ask {name} about this mock exam", { name });
    case "subject":
      return isModule
        ? t("Ask {name} about this module", { name })
        : t("Ask {name} about this subject", { name });
    default:
      return kind satisfies never;
  }
}

type AskTutorSize = "bar" | "sm" | "task";

const TASK_ASK_CLASS = cn(
  "size-11 shrink-0 px-0 lg:w-auto lg:px-4 lg:pl-2",
  "with-aside:group-data-aside/task:fixed with-aside:group-data-aside/task:right-frame with-aside:group-data-aside/task:bottom-[max(var(--spacing-frame),env(safe-area-inset-bottom))] with-aside:group-data-aside/task:w-[calc(var(--task-aside)-2*var(--spacing-frame)-1px)] with-aside:group-data-aside/task:justify-start",
);

const BAR_ASK_CLASS = cn(
  "min-w-11 shrink",
  "max-[18rem]:w-11 max-[18rem]:px-0",
  "max-sm:group-data-title-away/page-bar:w-11 max-sm:group-data-title-away/page-bar:px-0",
);

const BAR_ASK_LABEL_CLASS =
  "truncate max-[18rem]:hidden max-sm:group-data-title-away/page-bar:hidden";

function AskTutorRow({ identity, kind }: { identity: TutorIdentity; kind: ScreenKind }) {
  const openDrawer = useOpenDrawer(kind);
  const label = useAskLabel({ kind, name: identity.name });

  return (
    <ListRowButton aria-haspopup="dialog" {...PRELOAD_ON_INTENT} onClick={openDrawer}>
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
  kind: ScreenKind;
  size: AskTutorSize;
}) {
  const t = useExtracted();
  const openDrawer = useOpenDrawer(kind);
  const label = useAskLabel({ kind, name: identity.name });

  const name = t("Ask {name}", { name: identity.name });

  if (size === "task") {
    return (
      <Button
        aria-haspopup="dialog"
        {...PRELOAD_ON_INTENT}
        aria-label={label}
        className={TASK_ASK_CLASS}
        onClick={openDrawer}
        size="xl"
        type="button"
        variant="outline"
      >
        <AskTutorFace identity={identity} />
        <span className="truncate max-lg:hidden">{name}</span>
      </Button>
    );
  }

  return (
    <Button
      aria-haspopup="dialog"
      {...PRELOAD_ON_INTENT}
      aria-label={label}
      className={cn("pl-1.5", size === "bar" && BAR_ASK_CLASS)}
      onClick={openDrawer}
      size={size}
      type="button"
      variant="outline"
    >
      <AskTutorFace identity={identity} />
      <span className={BAR_ASK_LABEL_CLASS}>{name}</span>
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

  const Drawer = questionPanel.useModule({ enabled: opened })?.LessonQuestionDrawer;

  if (!Drawer) {
    return null;
  }

  return <Drawer identity={identity} navigation={navigation} open={state.isOpen} />;
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

type SharedTutor = { identity: TutorIdentity; kind: ScreenTarget["kind"] };

const SharedTutorContext = createContext<SharedTutor | null>(null);

/**
 * One conversation for a screen that places the tutor's entry more than once (a bar on a phone, a
 * row in the side column from wide screens): every `AskTutorEntry` inside opens this one, so a
 * layout change that swaps the entry keeps what the learner asked. Keep `target` and `tutor` stable.
 * `isModule`: the target is a subject of a plan that isn't for an exam, which calls it a module.
 */
export function AskTutorScope({
  children,
  isModule = false,
  target,
  tutor,
}: {
  children: React.ReactNode;
  isModule?: boolean;
  target: ScreenTarget;
  tutor: LessonTutorConfig;
}) {
  const identity = useTutorIdentity(tutor.buddy);
  const shared = useMemo(() => ({ identity, kind: target.kind }), [identity, target.kind]);

  return (
    <ModuleSubjectContext value={isModule}>
      <AskTutorProvider identity={identity} target={target} tutor={tutor}>
        <SharedTutorContext value={shared}>{children}</SharedTutorContext>
      </AskTutorProvider>
    </ModuleSubjectContext>
  );
}

/** An entry to the conversation of the `AskTutorScope` around it. */
export function AskTutorEntry({
  appearance = "button",
  size = "sm",
}: {
  appearance?: "button" | "row";
  size?: AskTutorSize;
}) {
  const shared = use(SharedTutorContext);

  if (!shared) {
    throw new Error("AskTutorEntry needs an AskTutorScope around it");
  }

  return appearance === "row" ? (
    <AskTutorRow identity={shared.identity} kind={shared.kind} />
  ) : (
    <AskTutorButton identity={shared.identity} kind={shared.kind} size={size} />
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
