"use client";

import { Button } from "@zoonk/ui/components/button";
import { type MicrophoneProblem } from "@zoonk/ui/hooks/voice-recorder";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type CallLimit, useLiveLimit } from "../../_components/help-limit-notice";
import { TaskActions } from "../../_components/task-layout";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { useMicrophoneOffWords } from "./call-intro-footer";
import { CallLimitReason, useCallLimitTitle } from "./call-limit-message";
import { useRefusalCopy } from "./call-refusal-copy";
import { ChallengeCallGate, useChallengeCallGateTitle } from "./challenge-call-gate";
import { CallOffMessage } from "./conversation-parts";
import { type DroppedCall } from "./dropped-call";
import { type CallAudio, openTypedCallAudio } from "./use-call-microphone";

const REACHED: CallLimit = { period: "day", tier: "plus" };

/**
 * Titled by what stopped the call: only a lost connection "dropped". Once call time comes back
 * nothing ran out, so the notice's own line says it under no title.
 */
function useDroppedTitle({
  opened,
  limit,
  reason,
}: {
  limit: CallLimit;
  opened: boolean;
  reason: DroppedCall["reason"];
}): string | undefined {
  const t = useExtracted();
  const copy = useRefusalCopy();
  const limitTitle = useCallLimitTitle(limit);
  const gateTitle = useChallengeCallGateTitle();

  if (reason === "limit") {
    return opened ? undefined : limitTitle;
  }

  if (reason === "plusRequired") {
    return gateTitle;
  }

  if (reason === "callInProgress" || reason === "callsPaused" || reason === "ended") {
    return copy[reason].title;
  }

  return t("The call dropped");
}

function DroppedCallReason({
  limit,
  microphoneText,
  reason,
}: {
  limit: CallLimit;
  /** What to do about the microphone, when it's what stopped the call; the screen's title names it. */
  microphoneText: string | null;
  reason: DroppedCall["reason"];
}) {
  const t = useExtracted();
  const copy = useRefusalCopy();

  if (reason === "limit") {
    return <CallLimitReason limit={limit} untitled />;
  }

  if (microphoneText) {
    return <p className="text-muted-foreground text-pretty">{microphoneText}</p>;
  }

  if (reason === "plusRequired") {
    return <ChallengeCallGate form="untitled" />;
  }

  if (reason === "callInProgress" || reason === "callsPaused" || reason === "ended") {
    return <p className="text-muted-foreground text-pretty">{copy[reason].text}</p>;
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
  const reached = limit ?? REACHED;
  const liveLimit = useLiveLimit(limit);
  const opened = limit !== null && liveLimit === null;
  const retry = dropped.reason === "limit" && opened ? "callAgain" : dropped.retry;
  const droppedTitle = useDroppedTitle({ limit: reached, opened, reason: dropped.reason });
  const microphone = useMicrophoneOffWords({ name, problem: microphoneProblem ?? "blocked" });
  const microphoneOff = dropped.reason === "microphone" && microphoneProblem !== null;

  return (
    <TaskFrame
      exitHref={null}
      footer={<DroppedCallActions {...actions} retry={retry} />}
      headerTitle={title}
    >
      <CallOffMessage title={microphoneOff ? microphone.title : droppedTitle}>
        <DroppedCallReason
          limit={reached}
          microphoneText={microphoneOff ? microphone.text : null}
          reason={dropped.reason}
        />
      </CallOffMessage>
    </TaskFrame>
  );
}
