"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type LanguageConversationIntro } from "@zoonk/core/language/conversations/start";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PageEyebrow } from "../../_components/page";
import { SectionLabel } from "../../_components/section-label";
import { TaskActions, TaskAsideContent } from "../../_components/task-layout";
import { useFormatDuration } from "../../_utils/time-format";
import { ChallengeCallPlusNotice, SeePlusAction } from "../../challenge/challenge-plus-lock";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { ChecklistRow, ChecklistRows } from "../checklist-rows";
import { ExamTaskIntro } from "../exam-speaking/exam-task-intro";
import { useConversationTitle } from "./conversation-labels";
import { CharacterRow, MicNote } from "./conversation-parts";
import { loadLiveCallSession } from "./use-live-call";

/** Where a checkpoint's Start stands until its call takes the intro's place. */
type CheckpointStart = "failed" | "idle" | "plusRequired" | "starting";

/**
 * The same intro and Start click, before the start command has created the conversation. Start
 * says it's starting while the call is created, and the host then opens the call in its place. A
 * start that didn't go through says so above Start, which tries again; Plus lapsed meanwhile locks
 * it. Leaving abandons a start still on its way: back on the page, Start is ready again, and that
 * start's answer changes nothing.
 */
export function CheckpointCallIntro({
  conversation,
  onStart,
}: {
  conversation: LanguageConversationIntro;
  onStart: () => Promise<"cancelled" | "failed" | "plusRequired" | "ready">;
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
    const mine = attempt.current + 1;
    attempt.current = mine;
    setStart("starting");

    const result = await onStart().catch(() => "failed" as const);

    // A ready call replaces the intro; one dropped for another learner leaves Start ready.
    if (mine === attempt.current && result !== "ready") {
      setStart(result === "cancelled" ? "idle" : result);
    }
  };

  return (
    <CallIntro
      conversation={conversation}
      exitHref="/today"
      footer={
        <CallIntroFooter
          failed={start === "failed"}
          locked={start === "plusRequired"}
          onStart={() => void run()}
          starting={start === "starting"}
        />
      }
    />
  );
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
  const footer = <CallIntroFooter locked={locked} onStart={onStart} />;

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
 * Start, or "See Plus" for a locked call. A start on its way (`starting`) shows a spinner in the
 * phone's place, and one that didn't go through (`failed`) says so above it.
 */
function CallIntroFooter({
  failed = false,
  locked,
  onStart,
  starting = false,
}: {
  failed?: boolean;
  locked: boolean;
  onStart: () => void;
  starting?: boolean;
}) {
  const t = useExtracted();

  if (locked) {
    return (
      <>
        <ChallengeCallPlusNotice />
        <SeePlusAction />
      </>
    );
  }

  return (
    <>
      {failed && (
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
