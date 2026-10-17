"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { LifeBuoyIcon, MicIcon, MicOffIcon, PhoneOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LiveCall } from "./use-live-call";

/** What the call is doing right now, in a few words. */
function useCallStatus({ call, name }: { call: LiveCall; name: string }) {
  const t = useExtracted();

  // "Try again" calls before the first ring: it's already calling. Calling again while this call's
  // last connection finishes closing says so.
  if (call.phase === "connecting" || call.phase === "idle") {
    return call.reconnecting ? t("Reconnecting…") : t("Calling…");
  }

  if (call.micBlocked) {
    return t("Microphone off");
  }

  if (call.muted) {
    return t("Muted");
  }

  return call.isPlaying ? t("{name} is talking…", { name }) : t("Listening…");
}

/**
 * The call's one status line, under what was said, the way a chat says someone is typing:
 * calling, who is talking, listening, muted. Screen readers hear it as it changes.
 */
export function CallStatus({ call, name }: { call: LiveCall; name: string }) {
  const status = useCallStatus({ call, name });

  return (
    <p aria-live="polite" className="text-muted-foreground text-[0.8125rem]" role="status">
      {status}
    </p>
  );
}

/**
 * The call's controls in the action bar, one row of equal buttons: Help (phrases to use), the
 * microphone, which mutes, and End. Muted, the microphone's button stays pressed.
 */
export function CallControls({
  call,
  onEnd,
  onHelp,
}: {
  call: LiveCall;
  onEnd: () => void;
  onHelp: () => void;
}) {
  const t = useExtracted();
  const isOff = call.micBlocked || call.muted;
  const canMute = call.phase === "live" && !call.micBlocked;

  return (
    <div className="flex gap-2 *:min-w-0 *:flex-1">
      <Button onClick={onHelp} size="lg" type="button" variant="outline">
        <LifeBuoyIcon aria-hidden="true" />
        {t("Help")}
      </Button>
      <Button
        aria-pressed={call.muted}
        className={cn(call.muted && "bg-secondary")}
        disabled={!canMute}
        onClick={call.toggleMute}
        size="lg"
        type="button"
        variant="outline"
      >
        {isOff ? <MicOffIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
        {t("Mute")}
      </Button>
      {/* Hanging up is the one red control; hovered, it tints red instead of the outline's gray,
          on which the red label would lose its contrast. */}
      <Button
        className="text-destructive-text hover:bg-destructive/10 hover:text-destructive-text"
        onClick={onEnd}
        size="lg"
        type="button"
        variant="outline"
      >
        <PhoneOffIcon aria-hidden="true" />
        {t("End")}
      </Button>
    </div>
  );
}
