"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { LearnerBubble } from "@zoonk/ui/components/message";
import { cn } from "@zoonk/ui/lib/utils";
import { ClockIcon, LightbulbIcon, SendIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { LIST_GROUP_CLASS } from "../../_components/list-group";
import { SectionLabel } from "../../_components/section-label";
import { TaskHeaderTitle } from "../../_components/task-header";
import { formatClock } from "../../_utils/clock";
import { TaskFrame } from "../../shell/task-frame";
import { useTaskRoleNoun } from "../exam-speaking/exam-speaking-labels";
import { CallControls, CallStatus } from "./call-control";
import { CallNote } from "./call-note";
import { CallObjectives, countMetGoals } from "./call-objectives";
import { CharacterRow } from "./conversation-parts";
import { type LiveCall } from "./use-live-call";

const MS_PER_SECOND = 1000;

/**
 * What was said, as the buddy's chats show it: the character's words as plain text on the left,
 * the learner's in a soft bubble on the right.
 */
function Transcript({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Conversation")} className="flex flex-col gap-3" role="log">
      {call.turns.map((turn, index) =>
        turn.speaker === "learner" ? (
          <LearnerBubble
            // Turns only grow at the end, so their position identifies them.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            lang={conversation.targetLanguage}
          >
            <span className="sr-only">{t("You:")} </span>
            {turn.text}
          </LearnerBubble>
        ) : (
          <p
            className="max-w-[80%] self-start text-[0.9375rem] leading-relaxed text-pretty"
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            lang={conversation.targetLanguage}
          >
            <span className="sr-only">{`${conversation.character.name}:`} </span>
            {turn.text}
          </p>
        ),
      )}
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
      <Button className="size-11" disabled={!canSend || !text.trim()} size="icon" type="submit">
        <SendIcon aria-hidden="true" />
        <span className="sr-only">{t("Send")}</span>
      </Button>
    </form>
  );
}

/** The phrases Help offers, in a list to glance at while talking. */
function Phrases({ conversation }: { conversation: LanguageConversationView }) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel id={titleId}>{t("Phrases you can use")}</SectionLabel>
      <ul aria-labelledby={titleId} className={LIST_GROUP_CLASS}>
        {conversation.hints.map((hint) => (
          <li
            className="py-2.5 text-[0.9375rem] leading-snug text-pretty"
            key={hint}
            lang={conversation.targetLanguage}
          >
            {hint}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An 8px dot before the clock: green once the call is live, quiet while it's still ringing. */
function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "me-1.5 inline-block size-2 rounded-full align-[0.05em] transition-colors duration-150 motion-reduce:transition-none",
        live ? "bg-success" : "bg-muted-foreground/40",
      )}
    />
  );
}

/** A limit takes priority over the next goal's tip, wherever the call's context sits. */
function CallTip({
  limitNear,
  next,
}: {
  limitNear: LiveCall["limitNear"];
  next: LanguageConversationView["objectives"][number] | undefined;
}) {
  const t = useExtracted();

  if (limitNear) {
    return (
      <CallNote role="status">
        <ClockIcon aria-hidden="true" />
        <span>
          {limitNear === "month"
            ? t("Your call time for this month is almost up.")
            : t("Your call time for today is almost up.")}
        </span>
      </CallNote>
    );
  }

  return next ? (
    <CallNote>
      <LightbulbIcon aria-hidden="true" />
      <span>{t("Tip: {goal}", { goal: next.description })}</span>
    </CallNote>
  ) : null;
}

/**
 * The call itself: who the learner talks to, the goals as they're met, what was said with the
 * call's status under it, and a tip for the next goal (or, when the plan's call time is running
 * out, that it is); the call's title and its clock on top; in the action bar a typed reply and
 * three controls (Help with phrases to use, the microphone, which mutes, and End). Nothing is
 * graded while talking. An exam task shows its card where the goals would be.
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
  const roleNoun = useTaskRoleNoun();
  const { character, examTask } = conversation;

  const next = examTask
    ? undefined
    : conversation.objectives.find((objective) => !call.metLabels.includes(objective.label));

  const clock = t("{elapsed} / {limit}", {
    elapsed: formatClock(call.elapsedSeconds * MS_PER_SECOND),
    limit: formatClock(call.limitSeconds * MS_PER_SECOND),
  });

  return (
    <TaskFrame
      aside={{
        children: (
          <>
            <CallObjectives conversation={conversation} met={call.metLabels} titled={false} />
            <CallTip limitNear={call.limitNear} next={next} />
            {usedHelp && <Phrases conversation={conversation} />}
          </>
        ),
        label: t("Call goals and phrases"),
        // Named in the aside's header row, as every task's aside is.
        meta: examTask
          ? undefined
          : `${countMetGoals(conversation, call.metLabels)}/${conversation.objectives.length}`,
        title: examTask ? undefined : t("Goals of the call"),
      }}
      exitHref={null}
      footer={
        // A call's controls stay under its transcript, at the column's measure, rather than in the
        // bar's corners.
        <div className="lg:max-w-column flex w-full flex-col gap-2 lg:mx-auto lg:px-4">
          <TypedReply call={call} />
          <CallControls call={call} onEnd={onEnd} onHelp={onHelp} />
        </div>
      }
      headerTitle={
        <TaskHeaderTitle
          announce={false}
          detail={
            <>
              <LiveDot live={call.phase === "live"} />
              {clock}
            </>
          }
          title={conversation.title}
        />
      }
    >
      <CharacterRow
        detail={
          examTask
            ? roleNoun(examTask.task.role)
            : t("{role} · {place}", { place: character.place, role: character.role })
        }
        name={character.name}
        talking={call.isPlaying}
      />

      <div className="lg:hidden">
        <CallObjectives conversation={conversation} met={call.metLabels} />
      </div>

      <div className="flex flex-col gap-3">
        <Transcript call={call} conversation={conversation} />
        <CallStatus call={call} name={character.name} />
      </div>

      <div className="flex flex-col gap-6 lg:hidden">
        <CallTip limitNear={call.limitNear} next={next} />
        {usedHelp && <Phrases conversation={conversation} />}
      </div>
    </TaskFrame>
  );
}
