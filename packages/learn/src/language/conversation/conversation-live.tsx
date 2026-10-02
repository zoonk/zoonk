"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Progress } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import {
  CircleCheckIcon,
  CircleIcon,
  LifeBuoyIcon,
  LightbulbIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  SendIcon,
} from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { formatClock } from "../../_utils/clock";
import { useExperienceMode } from "../../mode-provider";
import { TaskFrame } from "../../shell/task-frame";
import { useConversationTitle } from "./conversation-labels";
import { CharacterAvatar } from "./conversation-parts";
import { type LiveCall } from "./use-live-call";

const PERCENT = 100;
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
    <ul aria-label={t("Goals of the call")} className="flex flex-wrap gap-2">
      {conversation.objectives.map((objective) => {
        const done = met.includes(objective.label);

        return (
          <li
            className={cn(
              "in-data-[mode=fun]:fun-glass flex items-start gap-1.5 rounded-2xl border px-3 py-1 text-xs",
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

/** Fun's confidence meter: it fills as the learner gets each point across, never for perfect words. */
function Confidence({ met, total }: { met: number; total: number }) {
  const t = useExtracted();
  const locale = useLocale();
  const value = total === 0 ? 0 : Math.round((met / total) * PERCENT);

  return (
    <div className="fun-glass flex flex-col gap-2 rounded-2xl p-3">
      <div className="flex items-center justify-between text-sm">
        <span>{t("Confidence")}</span>
        <span aria-live="polite" className="font-fun-display font-semibold">
          {t("{value}/100", { value: String(value) })}
        </span>
      </div>
      <Progress locale={locale} aria-label={t("Confidence")} value={value} />
    </div>
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
              : "bg-muted in-data-[mode=fun]:fun-glass self-start",
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

function TypedReply({ call }: { call: LiveCall }) {
  const t = useExtracted();
  const [text, setText] = useState("");

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
        className="in-data-[mode=fun]:fun-glass"
        disabled={call.phase !== "live"}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("Or type your reply")}
        value={text}
      />
      <Button disabled={call.phase !== "live" || !text.trim()} size="icon" type="submit">
        <SendIcon aria-hidden="true" />
        <span className="sr-only">{t("Send")}</span>
      </Button>
    </form>
  );
}

function MicStatus({ call, name }: { call: LiveCall; name: string }) {
  const t = useExtracted();

  if (call.phase === "connecting") {
    return <p role="status">{t("Calling…")}</p>;
  }

  if (call.micBlocked) {
    return (
      <p className="flex items-start gap-2" role="status">
        <LineMarker>
          <MicOffIcon aria-hidden="true" className="size-4" />
        </LineMarker>
        {t("The microphone is off. Type your replies.")}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2" role="status">
      <LineMarker>
        <MicIcon
          aria-hidden="true"
          className={cn("size-4", call.isCapturing && "motion-safe:animate-pulse")}
        />
      </LineMarker>
      {call.isPlaying ? t("{name} is talking…", { name }) : t("Your turn to speak")}
    </p>
  );
}

/**
 * The call itself: the timer, the goals as they're met (Fun's confidence meter), what was said,
 * a tip for the next goal, Help (phrases to use, which costs Fun's third star), a typed reply, and
 * End. Nothing is graded while talking.
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
  const mode = useExperienceMode();
  const title = useConversationTitle(conversation);

  const next = conversation.objectives.find(
    (objective) => !call.metLabels.includes(objective.label),
  );

  return (
    <TaskFrame
      exitHref={null}
      footer={
        <>
          <TypedReply call={call} />
          <div className="flex items-center justify-between gap-3">
            <Button className="in-data-[mode=fun]:fun-glass" onClick={onHelp} variant="outline">
              <LifeBuoyIcon aria-hidden="true" />
              {t("Help")}
            </Button>
            <div className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
              <MicStatus call={call} name={conversation.character.name} />
            </div>
            <Button onClick={onEnd} variant="destructive">
              <PhoneOffIcon aria-hidden="true" />
              {mode === "fun" ? t("Hang up") : t("End")}
            </Button>
          </div>
        </>
      }
      headerEnd={
        <span aria-label={t("Time")} className="font-mono text-sm tabular-nums">
          {t("{elapsed} / {limit}", {
            elapsed: formatClock(call.elapsedSeconds * MS_PER_SECOND),
            limit: formatClock(call.limitSeconds * MS_PER_SECOND),
          })}
        </span>
      }
      headerTitle={title}
    >
      <div className="flex items-center gap-3">
        <CharacterAvatar name={conversation.character.name} />
        <div className="min-w-0">
          <p className="font-semibold">{conversation.character.name}</p>
          <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 truncate text-sm">
            {t("{role} · {place}", {
              place: conversation.character.place,
              role: conversation.character.role,
            })}
          </p>
        </div>
      </div>

      {mode === "fun" ? (
        <Confidence met={call.metLabels.length} total={conversation.objectives.length} />
      ) : (
        <Objectives conversation={conversation} met={call.metLabels} />
      )}

      <Transcript call={call} conversation={conversation} />

      {next && (
        <p className="bg-warning/10 text-foreground in-data-[mode=fun]:fun-glass flex items-start gap-2 self-center rounded-2xl px-3 py-1.5 text-sm">
          <LineMarker>
            <LightbulbIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("Tip: {goal}", { goal: next.description })}
        </p>
      )}

      {usedHelp && (
        <ul aria-label={t("Phrases you can use")} className="flex flex-col gap-1.5">
          {conversation.hints.map((hint) => (
            <li
              className="bg-muted in-data-[mode=fun]:fun-glass rounded-xl px-3 py-2 text-sm"
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
