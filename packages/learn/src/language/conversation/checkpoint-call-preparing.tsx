"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { TaskActions } from "../../_components/task-layout";
import { WritingWait } from "../../generation/writing-wait";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";
import { type CallStartOutcome, useCallStart } from "./use-call-start";

export function CheckpointCallPreparing({
  exitHref,
  onStart,
  unitTitle,
}: {
  exitHref: string;
  onStart: () => Promise<CallStartOutcome>;
  unitTitle: string;
}) {
  const t = useExtracted();
  const title = useConversationTitle({ exam: null, examTask: null, kind: "checkpoint" });
  const call = useCallStart({ onStart });

  if (call.writing) {
    return (
      <TaskFrame exitHref={exitHref} headerTitle={title}>
        <WritingWait className="pt-4" kind="conversationCall" writing={call.writing}>
          <GenerationTimelineTitle>{t("Getting your call ready")}</GenerationTimelineTitle>
          <GenerationTimelineDescription>
            {t("It opens here as soon as it's ready.")}
          </GenerationTimelineDescription>
        </WritingWait>
      </TaskFrame>
    );
  }

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={
        <TaskActions>
          <TaskMainButton busy={call.isStarting} onClick={call.start}>
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
        {call.failed && (
          <p className="text-destructive-text text-sm" role="alert">
            {t("The call didn't start. Try again in a moment.")}
          </p>
        )}
      </header>
    </TaskFrame>
  );
}
