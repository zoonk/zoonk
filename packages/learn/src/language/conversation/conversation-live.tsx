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
import { PageSectionTitle } from "../../_components/page";
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
            // oxlint-disable-next-line react/no-array-index-key -- Turns only grow at the end, so their position identifies them.
            key={index}
            lang={conversation.targetLanguage}
          >
            <span className="sr-only">{t("You:")} </span>
            {turn.text}
          </LearnerBubble>
        ) : (
          <p
            className="max-w-[80%] self-start text-[0.9375rem] leading-relaxed text-pretty"
            // oxlint-disable-next-line react/no-array-index-key -- Turns only grow at the end, so their position identifies them.
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

function Phrases({ conversation }: { conversation: LanguageConversationView }) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <div className="flex flex-col gap-2">
      <PageSectionTitle id={titleId}>{t("Phrases you can use")}</PageSectionTitle>
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
        meta: examTask
          ? undefined
          : `${countMetGoals(conversation, call.metLabels)}/${conversation.objectives.length}`,
        title: examTask ? undefined : t("Goals of the call"),
      }}
      exitHref={null}
      footer={
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
