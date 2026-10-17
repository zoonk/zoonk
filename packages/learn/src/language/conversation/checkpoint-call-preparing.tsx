"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { TaskActions } from "../../_components/task-layout";
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
 * A language goal's checkpoint whose call isn't written yet, on the page as a call's intro is: a
 * session's preparation usually writes it ahead, so this is rare. Opening the screen writes
 * nothing; the learner's tap starts writing it for their speaking level, the wait shows it
 * happening, and the host opens the call once it's ready (false when it didn't start).
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
  const title = useConversationTitle({ exam: null, examTask: null, kind: "checkpoint" });
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
          <TaskActions>
            <TaskMainButton onClick={() => void start()}>
              <PhoneIcon aria-hidden="true" />
              {t("Get the call ready")}
            </TaskMainButton>
          </TaskActions>
        }
        headerTitle={title}
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-title text-balance">{unitTitle}</h1>
          <p className="text-muted-foreground text-pretty">
            {t(
              "This challenge is a short call about the unit. It's written for your speaking level first, which takes up to half a minute.",
            )}
          </p>
        </header>
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
