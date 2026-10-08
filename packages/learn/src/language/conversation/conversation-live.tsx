"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import {
  CircleCheckIcon,
  CircleIcon,
  ClockIcon,
  LifeBuoyIcon,
  LightbulbIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  SendIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { TaskHeaderTitle } from "../../_components/task-header";
import { formatClock } from "../../_utils/clock";
import { TaskFrame } from "../../shell/task-frame";
import { CharacterAvatar } from "./conversation-parts";
import { type LiveCall } from "./use-live-call";

const MS_PER_SECOND = 1000;

function Objectives({
  conversation,
  met,
}: {
  conversation: LanguageConversationView;
  met: string[];
}) {
  const t = useExtracted();

  return (
    <ul aria-label={t("Goals of the call")} className="flex flex-wrap justify-center gap-2">
      {conversation.objectives.map((objective) => {
        const done = met.includes(objective.label);

        return (
          <li
            className={cn(
              "flex items-start gap-1.5 rounded-2xl border px-3 py-1 text-xs",
              done && "border-success text-success",
            )}
            key={objective.label}
            lang={conversation.targetLanguage}
          >
            {/* A long goal wraps inside the chip with its mark on the first line. */}
            <LineMarker>
              {done ? (
                <CircleCheckIcon aria-hidden="true" className="size-3.5" />
              ) : (
                <CircleIcon aria-hidden="true" className="size-3.5" />
              )}
            </LineMarker>
            {objective.label}
            <span className="sr-only">{done ? t("done") : t("not yet")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Transcript({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Conversation")} className="flex flex-col gap-2" role="log">
      {call.turns.map((turn, index) => (
        <p
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5",
            turn.speaker === "learner"
              ? "bg-primary text-primary-foreground self-end"
              : "bg-muted self-start",
          )}
          // Turns only grow at the end, so their position identifies them.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          lang={conversation.targetLanguage}
        >
          <span className="sr-only">
            {turn.speaker === "learner" ? t("You:") : `${conversation.character.name}:`}{" "}
          </span>
          {turn.text}
        </p>
      ))}
    </div>
  );
}

/** Typing works from the first ring: what's sent while the call connects goes out once it does. */
function TypedReply({ call }: { call: LiveCall }) {
  const t = useExtracted();
  const [text, setText] = useState("");
  const canSend = call.phase === "connecting" || call.phase === "live";

  const send = () => {
    const trimmed = text.trim();

    if (trimmed) {
      call.sendText(trimmed);
      setText("");
    }
  };

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Input
        aria-label={t("Type your reply")}
        disabled={!canSend}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("Or type your reply")}
        value={text}
      />
      <Button disabled={!canSend || !text.trim()} size="icon" type="submit">
        <SendIcon aria-hidden="true" />
        <span className="sr-only">{t("Send")}</span>
      </Button>
    </form>
  );
}

/** What the microphone is doing, under its button: the call's one status line. */
function useMicLabel({ call, name }: { call: LiveCall; name: string }) {
  const t = useExtracted();

  // "Try again" calls before the first ring: it's already calling.
  if (call.phase === "connecting" || call.phase === "idle") {
    return t("Calling…");
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
 * A round call control with its name under it, like a phone's. The microphone's line says what
 * it's doing instead, so its button is named on its own.
 */
function CallControl({
  children,
  className,
  disabled = false,
  label,
  name,
  onClick,
  pressed,
  size = "md",
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  name?: string;
  onClick: () => void;
  pressed?: boolean;
  size?: "lg" | "md";
  variant: "default" | "destructive" | "outline";
}) {
  const labelId = useId();

  return (
    <div className="flex w-20 flex-col items-center gap-1.5">
      <Button
        aria-label={name}
        aria-labelledby={name ? undefined : labelId}
        aria-pressed={pressed}
        className={cn(
          "rounded-full",
          size === "lg" ? "size-18 [&_svg]:size-7" : "size-13 [&_svg]:size-5",
          className,
        )}
        disabled={disabled}
        onClick={onClick}
        size="icon"
        type="button"
        variant={variant}
      >
        {children}
      </Button>
      <span
        aria-live={name ? "polite" : undefined}
        className="text-muted-foreground text-center text-xs leading-4 text-balance"
        id={labelId}
      >
        {label}
      </span>
    </div>
  );
}

function MicControl({ call, name }: { call: LiveCall; name: string }) {
  const t = useExtracted();
  const label = useMicLabel({ call, name });
  const isOff = call.micBlocked || call.muted;
  const canMute = call.phase === "live" && !call.micBlocked;

  return (
    <CallControl
      className={cn(call.isCapturing && !isOff && "motion-safe:animate-pulse")}
      disabled={!canMute}
      label={label}
      name={t("Mute")}
      onClick={call.toggleMute}
      pressed={call.muted}
      size="lg"
      variant={isOff ? "outline" : "default"}
    >
      {isOff ? <MicOffIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
    </CallControl>
  );
}

/**
 * The call itself, like a phone call: the character, the goals as they're met, what was said and a
 * tip for the next goal (or, when the plan's call time is running out, that it is); the call's title
 * and its clock on top; at the bottom a typed reply and three controls (Help with phrases to use,
 * the microphone, which mutes, and End). Nothing is graded while talking.
 */
export function ConversationLive({
  call,
  conversation,
  onEnd,
  onHelp,
  usedHelp,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
  onEnd: () => void;
  onHelp: () => void;
  usedHelp: boolean;
}) {
  const t = useExtracted();
  const { character } = conversation;

  const next = conversation.objectives.find(
    (objective) => !call.metLabels.includes(objective.label),
  );

  const clock = t("{elapsed} / {limit}", {
    elapsed: formatClock(call.elapsedSeconds * MS_PER_SECOND),
    limit: formatClock(call.limitSeconds * MS_PER_SECOND),
  });

  return (
    <TaskFrame
      exitHref={null}
      footer={
        <>
          <TypedReply call={call} />
          <div className="flex items-start justify-center gap-6 pt-2">
            <CallControl label={t("Help")} onClick={onHelp} variant="outline">
              <LifeBuoyIcon aria-hidden="true" />
            </CallControl>
            <MicControl call={call} name={character.name} />
            <CallControl label={t("End")} onClick={onEnd} variant="destructive">
              <PhoneOffIcon aria-hidden="true" />
            </CallControl>
          </div>
        </>
      }
      headerTitle={<TaskHeaderTitle detail={clock} title={conversation.title} />}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <CharacterAvatar name={character.name} size="lg" talking={call.isPlaying} />
        <div>
          <p className="font-semibold">{character.name}</p>
          <p className="text-muted-foreground text-sm">
            {t("{role} · {place}", { place: character.place, role: character.role })}
          </p>
        </div>
      </div>

      <Objectives conversation={conversation} met={call.metLabels} />

      <Transcript call={call} conversation={conversation} />

      {call.limitNear ? (
        <p
          className="bg-muted text-foreground flex items-start gap-2 self-center rounded-2xl px-3 py-1.5 text-sm"
          role="status"
        >
          <LineMarker>
            <ClockIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {call.limitNear === "month"
            ? t("Your call time for this month is almost up.")
            : t("Your call time for today is almost up.")}
        </p>
      ) : (
        next && (
          <p className="bg-warning/10 text-foreground flex items-start gap-2 self-center rounded-2xl px-3 py-1.5 text-sm">
            <LineMarker>
              <LightbulbIcon aria-hidden="true" className="size-4" />
            </LineMarker>
            {t("Tip: {goal}", { goal: next.description })}
          </p>
        )
      )}

      {usedHelp && (
        <ul aria-label={t("Phrases you can use")} className="flex flex-col gap-1.5">
          {conversation.hints.map((hint) => (
            <li
              className="bg-muted rounded-xl px-3 py-2 text-sm"
              key={hint}
              lang={conversation.targetLanguage}
            >
              {hint}
            </li>
          ))}
        </ul>
      )}
    </TaskFrame>
  );
}
