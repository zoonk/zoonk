"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/start";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PageEyebrow } from "../../_components/page";
import { SectionLabel } from "../../_components/section-label";
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

/**
 * Where a checkpoint's Start stands until its call takes the intro's place: Plus lapsed meanwhile
 * (`plusRequired`) stays, and only `failed` asks for another try.
 */
type CheckpointStart = "failed" | "idle" | "plusRequired" | "starting";

/** What the intro's footer shows: Start's state, or today's study time used up. */
type CallIntroFooterState = CheckpointStart | "dailyLimitReached";

/**
 * What the start command came to. `changed`: the checkpoint changed since the page showed it
 * (including today's study time used up meanwhile), and the host reads the page again
 * (`rereading`), which opens where it stands.
 */
type CheckpointStartResult = "cancelled" | "changed" | "failed" | "plusRequired" | "ready";

/**
 * The same intro and Start click, before the start command has created the conversation. The tap
 * opens the microphone (Safari on iOS asks for it only while the tap is active): the host hands it
 * to the call once it's created, and it's let go of when the call isn't. Start says it's starting
 * while the call is created, and the host then opens the call in its place. A start that didn't go
 * through says so above Start, which tries again; Plus lapsed meanwhile locks it. Today's study time
 * used up (`dailyLimitReached`, as the page read it) says when the call is back, with the way back
 * to Today in Start's place, so nothing asks for the microphone. Leaving abandons a start still on
 * its way: back on the page, Start is ready again, and that start's answer changes nothing.
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

  // A screen kept hidden after leaving runs this too, and shows Start ready when it's back.
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

    // A ready call replaces the intro. A start dropped for another learner leaves Start ready, and
    // so does a change, busy while the page is read again.
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

/** The page's own reading comes first: busy while it's read again, then its daily limit. */
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

/**
 * Before the call, on the page: how long it lasts and the level it's written for, its title and
 * why, who the learner talks to, the goals to get across as a checklist, and that they can speak
 * or type and the microphone is only used during the call. One button (or Enter) starts it;
 * Escape leaves, since nothing has started. A call the learner's plan leaves to Plus (`locked`)
 * says what Plus unlocks, with "See Plus" in place of Start, as its challenge intro does. An exam's
 * speaking task shows its card instead (`ExamTaskIntro`), with the same footer.
 */
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

/** Reaching for Start loads the call's realtime client, so the call connects as soon as before. */
function preloadLiveCall() {
  void loadLiveCallSession();
}

/**
 * The call intro's action bar: a status region mounted from the start, so today's study time used up
 * (`dailyLimitReached`), which can replace a refused Start, is read out as it arrives, then the
 * actions.
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

/**
 * Start, or "See Plus" for a locked call. A start on its way (`starting`) shows a spinner in the
 * phone's place, and one that didn't go through (`failed`) says so above it. Past today's study
 * time, the way back to Today takes Start's place.
 */
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

  // From `lg` the goals sit beside the intro, where the live call keeps them, so the call's column
  // stays put when it starts.
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
        <SectionLabel className="lg:sr-only" id="call-goals">
          {t("What to get across")}
        </SectionLabel>
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
