"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/start";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PageEyebrow, PageSectionTitle } from "../../_components/page";
import { StudyTimeUsedUpActions, StudyTimeUsedUpLine } from "../../_components/study-time-used-up";
import { TaskActions, TaskAsideContent } from "../../_components/task-layout";
import { useFormatDuration } from "../../_utils/time-format";
import { ChallengeCallPlusNotice, SeePlusAction } from "../../challenge/challenge-plus-lock";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { ChecklistRow, ChecklistRows } from "../checklist-rows";
import { ExamTaskIntro } from "../exam-speaking/exam-task-intro";
import { useConversationTitle } from "./conversation-labels";
import { CharacterRow, MicNote } from "./conversation-parts";
import { loadLiveCallSession } from "./load-live-call-session";
import { type TappedCallAudio, openCallAudioInTap } from "./use-call-microphone";

type CheckpointStart = "failed" | "idle" | "plusRequired" | "starting";

type CallIntroFooterState = CheckpointStart | "dailyLimitReached";

type CheckpointStartResult = "cancelled" | "changed" | "failed" | "plusRequired" | "ready";

/**
 * The tap opens the microphone, since Safari on iOS asks for it only during a tap; the host hands
 * it to the call.
 */
export function CheckpointCallIntro({
  conversation,
  dailyLimitReached,
  onStart,
  rereading,
}: {
  conversation: LanguageConversationIntro;
  dailyLimitReached: boolean;
  onStart: (audio: TappedCallAudio) => Promise<CheckpointStartResult>;
  rereading: boolean;
}) {
  const [start, setStart] = useState<CheckpointStart>("idle");
  const attempt = useRef(0);

  // Activity runs this when the screen hides too, so Start is ready when it's back.
  useEffect(
    () => () => {
      attempt.current += 1;
      setStart((current) => (current === "plusRequired" ? current : "idle"));
    },
    [],
  );

  const run = async () => {
    const audio = openCallAudioInTap();
    const mine = attempt.current + 1;
    attempt.current = mine;
    setStart("starting");

    const result = await onStart(audio).catch(() => "failed" as const);

    if (result !== "ready") {
      audio.release();
    }

    if (mine === attempt.current && result !== "ready") {
      setStart(result === "cancelled" || result === "changed" ? "idle" : result);
    }
  };

  return (
    <CallIntro
      conversation={conversation}
      exitHref="/today"
      footer={
        <CallIntroFooter
          onStart={() => void run()}
          start={toFooterState({ dailyLimitReached, rereading, start })}
        />
      }
    />
  );
}

function toFooterState({
  dailyLimitReached,
  rereading,
  start,
}: {
  dailyLimitReached: boolean;
  rereading: boolean;
  start: CheckpointStart;
}): CallIntroFooterState {
  if (rereading) {
    return "starting";
  }

  return dailyLimitReached ? "dailyLimitReached" : start;
}

export function ConversationIntro({
  conversation,
  exitHref,
  locked = false,
  onStart,
}: {
  conversation: LanguageConversationView;
  exitHref: string;
  locked?: boolean;
  onStart: () => void;
}) {
  const { examTask } = conversation;
  const footer = <CallIntroFooter onStart={onStart} start={locked ? "plusRequired" : "idle"} />;

  return examTask ? (
    <ExamTaskIntro
      conversation={conversation}
      examTask={examTask}
      exitHref={exitHref}
      footer={footer}
    />
  ) : (
    <CallIntro conversation={conversation} exitHref={exitHref} footer={footer} />
  );
}

function preloadLiveCall() {
  void loadLiveCallSession();
}

/**
 * Its status region is mounted from the start, so a line that replaces a refused Start is read out.
 */
function CallIntroFooter({ onStart, start }: { onStart: () => void; start: CallIntroFooterState }) {
  return (
    <>
      <div aria-atomic="true" aria-live="polite" className="empty:absolute" role="status">
        {start === "dailyLimitReached" && <StudyTimeUsedUpLine />}
      </div>
      <CallIntroActions onStart={onStart} start={start} />
    </>
  );
}

function CallIntroActions({
  onStart,
  start,
}: {
  onStart: () => void;
  start: CallIntroFooterState;
}) {
  const t = useExtracted();

  if (start === "plusRequired") {
    return (
      <>
        <ChallengeCallPlusNotice />
        <SeePlusAction />
      </>
    );
  }

  if (start === "dailyLimitReached") {
    return <StudyTimeUsedUpActions href="/today" />;
  }

  const starting = start === "starting";

  return (
    <>
      {start === "failed" && (
        <p className="text-destructive-text text-sm text-pretty" role="alert">
          {t("The call didn't start. Try again in a moment.")}
        </p>
      )}

      <TaskActions
        onFocus={preloadLiveCall}
        onPointerDown={preloadLiveCall}
        onPointerEnter={preloadLiveCall}
      >
        <TaskMainButton busy={starting} onClick={onStart}>
          {!starting && <PhoneIcon aria-hidden="true" />}
          {starting ? t("Starting…") : t("Start the call")}
        </TaskMainButton>
      </TaskActions>
    </>
  );
}

function CallIntro({
  conversation,
  exitHref,
  footer,
}: {
  conversation: LanguageConversationIntro;
  exitHref: string;
  footer: ReactNode;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const eyebrow = useConversationTitle(conversation);
  const { character } = conversation;

  return (
    <TaskFrame
      aside={{ label: t("What to get across"), title: t("What to get across") }}
      closeOnEscape
      exitHref={exitHref}
      footer={footer}
      headerTitle={eyebrow}
    >
      <header className="flex flex-col gap-2">
        <PageEyebrow>
          {t("{time} · Level {level}", {
            level: conversation.level,
            time: formatDuration(conversation.minutes),
          })}
        </PageEyebrow>
        <h1 className="text-title text-balance">{conversation.title}</h1>
        <p className="text-muted-foreground text-pretty">{conversation.situation}</p>
      </header>

      <CharacterRow
        detail={t("{role} · {place}", { place: character.place, role: character.role })}
        name={character.name}
      />

      <TaskAsideContent
        aria-labelledby="call-goals"
        className="flex w-full flex-col gap-1"
        role="region"
      >
        <PageSectionTitle className="lg:sr-only" id="call-goals">
          {t("What to get across")}
        </PageSectionTitle>
        <ChecklistRows>
          {conversation.objectives.map((objective) => (
            <ChecklistRow
              description={objective.description}
              done={false}
              key={objective.label}
              lang={conversation.targetLanguage}
            >
              {objective.label}
            </ChecklistRow>
          ))}
        </ChecklistRows>
      </TaskAsideContent>

      <MicNote>{t("Speak or type. The microphone is used only during the call.")}</MicNote>
    </TaskFrame>
  );
}
