"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";

type WriteState = "failed" | "idle" | "ready" | "writing";

function toRun({ retry, state }: { retry: () => void; state: WriteState }): GenerationRun {
  if (state === "failed") {
    return { failure: "notStarted", retry, status: "failed", steps: {} };
  }

  return state === "ready"
    ? { failure: null, status: "ready", steps: { writeCall: "completed" } }
    : { failure: null, status: "following", steps: { writeCall: "started" } };
}

/**
 * A language goal's checkpoint whose call isn't written yet: a session's preparation usually
 * writes it ahead, so this is rare. Opening the screen writes nothing; the learner's tap starts
 * writing it for their speaking level, the wait shows it happening, and the host opens the call
 * once it's ready (false when it didn't start).
 */
export function CheckpointCallPreparing({
  exitHref,
  onStart,
  unitTitle,
}: {
  exitHref: string;
  onStart: () => Promise<boolean>;
  unitTitle: string;
}) {
  const t = useExtracted();
  const title = useConversationTitle({ exam: null, kind: "checkpoint" });
  const [state, setState] = useState<WriteState>("idle");

  const start = async () => {
    setState("writing");
    const started = await onStart().catch(() => false);
    setState(started ? "ready" : "failed");
  };

  if (state === "idle") {
    return (
      <TaskFrame
        exitHref={exitHref}
        footer={
          <TaskMainButton onClick={() => void start()}>
            <PhoneIcon aria-hidden="true" />
            {t("Get the call ready")}
          </TaskMainButton>
        }
        headerTitle={title}
      >
        <div className="in-data-[mode=fun]:fun-glass flex flex-col items-center gap-3 rounded-3xl px-4 py-6 text-center">
          <span
            aria-hidden="true"
            className="bg-muted in-data-[mode=fun]:bg-fun-accent-violet/30 grid size-20 shrink-0 place-items-center rounded-full"
          >
            <PhoneIcon className="size-8" />
          </span>
          <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold tracking-tight text-balance">
            {unitTitle}
          </h1>
        </div>

        <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2">
          {t(
            "This checkpoint is a short call about the unit. It's written for your speaking level first, which takes up to half a minute.",
          )}
        </p>
      </TaskFrame>
    );
  }

  return (
    <TaskFrame exitHref={exitHref} headerTitle={title}>
      <GenerationWait
        className="pt-4"
        kind="conversationCall"
        run={toRun({ retry: () => void start(), state })}
      >
        <GenerationTimelineTitle>{t("Getting your call ready")}</GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t("It opens here as soon as it's ready.")}
        </GenerationTimelineDescription>
      </GenerationWait>
    </TaskFrame>
  );
}
