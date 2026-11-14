"use client";

import { type LessonKind } from "@zoonk/learn/generation/kinds";
import { TaskMainButton } from "@zoonk/learn/task-frame";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { useExtracted } from "next-intl";

export type WaitState = "notReady" | "gettingReady" | "ready" | "stopped";

/** A challenge's wait names a challenge: the learner tapped one on the Plan or Today. */
export function useWaitWords(kind: LessonKind) {
  const t = useExtracted();

  if (kind === "challenge") {
    return {
      gettingReady: t("Getting your challenge ready"),
      notReady: t("This challenge isn't ready yet"),
      ready: t("Your challenge is ready"),
      start: t("Start this challenge"),
      stopped: t("We couldn't get this challenge ready"),
    };
  }

  return {
    gettingReady: t("Getting your lesson ready"),
    notReady: t("This lesson isn't ready yet"),
    ready: t("Your lesson is ready"),
    start: t("Start this lesson"),
    stopped: t("We couldn't get this lesson ready"),
  };
}

export function WaitNote({ kind, state }: { kind: LessonKind; state: WaitState }) {
  const t = useExtracted();
  const title = useWaitWords(kind)[state];

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title">{title}</h1>
      {(state === "notReady" || state === "gettingReady") && (
        <p className="text-muted-foreground text-base leading-relaxed text-pretty">
          {t("It takes a few minutes, and keeps going if you leave.")}
        </p>
      )}
    </div>
  );
}

export function StartLessonBar({
  busy,
  kind,
  onStart,
  ready = false,
}: {
  busy: boolean;
  kind: LessonKind;
  onStart: () => void;
  ready?: boolean;
}) {
  const t = useExtracted();
  const words = useWaitWords(kind);

  return (
    <TaskActionBar>
      <TaskActions>
        <TaskMainButton busy={busy} onClick={onStart}>
          {ready ? words.start : t("Get it ready")}
        </TaskMainButton>
      </TaskActions>
    </TaskActionBar>
  );
}
