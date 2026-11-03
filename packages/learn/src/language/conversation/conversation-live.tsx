"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { LearnerBubble } from "@zoonk/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@zoonk/ui/components/message-scroller";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon, SendIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { TaskHeaderTitle, useTaskAsideShown } from "../../_components/task-header";
import { TaskBody } from "../../_components/task-layout";
import { formatClock } from "../../_utils/clock";
import { TaskFrame } from "../../shell/task-frame";
import { useTaskRoleNoun } from "../exam-speaking/exam-speaking-labels";
import { CallAnnouncer, CallControls, CallTurn } from "./call-control";
import { CallObjectives, countMetGoals } from "./call-objectives";
import { Phrases, PhrasesSheet } from "./call-phrases";
import { CallEndedStatus } from "./call-problem";
import { CharacterRow } from "./conversation-parts";
import { type LiveCall } from "./use-live-call";

const MS_PER_SECOND = 1000;
const PERCENT = 100;
const NO_BREAK_SPACE = "\u00A0";

export type CallEnding = { onRetry: () => void; state: "closing" | "failed" | "saving" };

function Transcript({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}) {
  const t = useExtracted();

  return (
    <MessageScrollerContent
      aria-label={t("Conversation")}
      aria-live="off"
      className="h-auto min-h-0 gap-3"
    >
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
    </MessageScrollerContent>
  );
}

/**
 * It takes focus only in a call made by typing: otherwise speaking comes first, and a phone's
 * keyboard would cover the call.
 */
function TypedReply({ call }: { call: LiveCall }) {
  const t = useExtracted();
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const { scrollToEnd } = useMessageScroller();
  const canSend = call.phase === "connecting" || call.phase === "live";
  const typedCall = call.micBlocked;

  useEffect(() => {
    if (typedCall && document.activeElement === document.body) {
      field.current?.focus();
    }
  }, [typedCall]);

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
        onChange={(event) => {
          setText(event.target.value);
          call.onTyping();
        }}
        // A phone's keyboard shrinks the view: the newest line stays in sight above it.
        onFocus={() => scrollToEnd({ behavior: "instant" })}
        placeholder={t("Or type your reply")}
        ref={field}
        value={text}
      />
      <Button className="size-11" disabled={!canSend || !text.trim()} size="icon" type="submit">
        <SendIcon aria-hidden="true" />
        <span className="sr-only">{t("Send")}</span>
      </Button>
    </form>
  );
}

function CallBody({
  call,
  conversation,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
}) {
  const t = useExtracted();
  const roleNoun = useTaskRoleNoun();
  const { character, examTask } = conversation;

  return (
    <MessageScroller>
      {/* The scroller keeps the newest line in place; the browser's own anchoring would move it twice. */}
      <MessageScrollerViewport
        aria-label={t("Call")}
        className="scroll-smooth [overflow-anchor:none] motion-reduce:scroll-auto"
      >
        <TaskBody>
          <CharacterRow
            detail={
              examTask
                ? roleNoun(examTask.task.role)
                : t("{role} · {place}", { place: character.place, role: character.role })
            }
            name={character.name}
            talking={Boolean(call.turn?.characterSpeaking)}
          />

          <div className="lg:hidden">
            <CallObjectives conversation={conversation} met={call.metLabels} />
          </div>

          <Transcript call={call} conversation={conversation} />
        </TaskBody>
      </MessageScrollerViewport>
      <MessageScrollerButton aria-label={t("Scroll to latest")} behavior="auto">
        <ArrowDownIcon aria-hidden="true" />
      </MessageScrollerButton>
    </MessageScroller>
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

function useCallProgress(call: LiveCall) {
  const t = useExtracted();
  const talkSeconds = call.talkSeconds ?? 0;
  const value = talkSeconds > 0 ? (call.elapsedSeconds / talkSeconds) * PERCENT : 0;

  return { label: t("Call time"), value: call.turn?.reason ? PERCENT : value };
}

export function ConversationLive({
  call,
  conversation,
  ending = null,
  grading,
  onEnd,
  onHelp,
  usedHelp,
}: {
  call: LiveCall;
  conversation: LanguageConversationView;
  ending?: CallEnding | null;
  grading: boolean;
  onEnd: () => void;
  onHelp: () => void;
  usedHelp: boolean;
}) {
  const t = useExtracted();
  const asideShown = useTaskAsideShown();
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const progress = useCallProgress(call);
  const { character, examTask } = conversation;
  const started = call.turn !== null;

  const help = () => {
    onHelp();

    if (!asideShown) {
      setPhrasesOpen(true);
    }
  };

  return (
    <MessageScrollerProvider autoScroll>
      <TaskFrame
        aside={{
          children: (
            <>
              <CallObjectives conversation={conversation} met={call.metLabels} titled={false} />
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
        fit="always"
        footer={
          <div className="lg:max-w-column flex w-full flex-col gap-3 lg:mx-auto lg:px-4">
            <CallAnnouncer
              call={call}
              ended={ending?.state === "saving"}
              grading={grading}
              name={character.name}
            />
            {ending ? (
              <CallEndedStatus grading={grading} onRetry={ending.onRetry} state={ending.state} />
            ) : (
              <>
                <CallTurn call={call} conversation={conversation} />
                <TypedReply call={call} />
                <CallControls call={call} onEnd={onEnd} onHelp={help} />
              </>
            )}
          </div>
        }
        headerTitle={
          <TaskHeaderTitle
            announce={false}
            // The clock's line is kept while the call rings, so nothing moves when it connects.
            detail={
              started ? (
                <>
                  <LiveDot live={call.phase === "live"} />
                  {formatClock(call.elapsedSeconds * MS_PER_SECOND)}
                </>
              ) : (
                NO_BREAK_SPACE
              )
            }
            title={conversation.title}
          />
        }
        progress={progress}
      >
        <CallBody call={call} conversation={conversation} />
      </TaskFrame>

      {!asideShown && (
        <PhrasesSheet
          conversation={conversation}
          onOpenChange={setPhrasesOpen}
          open={phrasesOpen}
        />
      )}
    </MessageScrollerProvider>
  );
}
