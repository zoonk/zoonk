"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type CallLimit } from "../../_components/help-limit-notice";
import { TaskActions } from "../../_components/task-layout";
import { ChallengeCallPlusNotice } from "../../challenge/challenge-plus-lock";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { MicrophoneOff } from "./call-intro-footer";
import { CallLimitReason } from "./call-limit-message";
import { useRefusalCopy } from "./call-refusal-copy";
import { CallOffMessage, CallReason } from "./conversation-parts";
import { type DroppedCall } from "./dropped-call";
import { type CallAudio, type MicrophoneProblem, openTypedCallAudio } from "./use-call-microphone";

function DroppedCallReason({
  limit,
  microphoneProblem,
  name,
  reason,
}: {
  limit: CallLimit | null;
  microphoneProblem: MicrophoneProblem | null;
  name: string;
  reason: DroppedCall["reason"];
}) {
  const t = useExtracted();
  const copy = useRefusalCopy();

  if (reason === "limit") {
    return <CallLimitReason limit={limit ?? { period: "day", tier: "plus" }} />;
  }

  if (reason === "microphone" && microphoneProblem) {
    return <MicrophoneOff name={name} problem={microphoneProblem} />;
  }

  if (reason === "plusRequired") {
    return <ChallengeCallPlusNotice cta />;
  }

  if (reason === "callInProgress" || reason === "callsPaused" || reason === "ended") {
    return (
      <CallReason title={copy[reason].title}>
        <p className="text-muted-foreground text-sm text-pretty">{copy[reason].text}</p>
      </CallReason>
    );
  }

  return (
    <p className="text-muted-foreground text-pretty">
      {t("Call again, or end the call to get feedback on what you said.")}
    </p>
  );
}

function DroppedCallActions({
  onEnd,
  onRetry,
  onStart,
  onTakeover,
  retry,
}: {
  onEnd: () => void;
  onRetry: () => void;
  onStart: (audio: CallAudio | null) => void;
  onTakeover: () => void;
  retry: DroppedCall["retry"];
}) {
  const t = useExtracted();
  const copy = useRefusalCopy();

  if (!retry) {
    return (
      <TaskActions>
        <TaskMainButton onClick={onEnd}>{t("End the call")}</TaskMainButton>
      </TaskActions>
    );
  }

  const main = {
    callAgain: { label: t("Call again"), onClick: onRetry },
    microphone: { label: t("Type instead"), onClick: () => onStart(openTypedCallAudio()) },
    takeover: { label: copy.takeover, onClick: onTakeover },
  }[retry];

  const crowded = retry !== "callAgain";

  return (
    <TaskActions className={cn(crowded && "max-lg:flex-col max-lg:items-stretch")}>
      <Button className="shrink-0" onClick={onEnd} size="lg" variant="outline">
        {t("End the call")}
      </Button>

      {retry === "microphone" && (
        <Button className="shrink-0" onClick={() => onStart(null)} size="lg" variant="outline">
          {t("Try again")}
        </Button>
      )}

      <TaskMainButton onClick={main.onClick}>{main.label}</TaskMainButton>
    </TaskActions>
  );
}

/** A call that dropped can always be ended and saved, and called again when that can work. */
export function DroppedCallScreen({
  dropped,
  limit,
  microphoneProblem,
  name,
  title,
  ...actions
}: {
  dropped: DroppedCall;
  limit: CallLimit | null;
  microphoneProblem: MicrophoneProblem | null;
  name: string;
  onEnd: () => void;
  onRetry: () => void;
  onStart: (audio: CallAudio | null) => void;
  onTakeover: () => void;
  title: string;
}) {
  const t = useExtracted();

  return (
    <TaskFrame
      exitHref={null}
      footer={<DroppedCallActions {...actions} retry={dropped.retry} />}
      headerTitle={title}
    >
      <CallOffMessage title={t("The call dropped")}>
        <DroppedCallReason
          limit={limit}
          microphoneProblem={microphoneProblem}
          name={name}
          reason={dropped.reason}
        />
      </CallOffMessage>
    </TaskFrame>
  );
}
