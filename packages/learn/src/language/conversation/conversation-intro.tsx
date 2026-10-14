"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { PhoneIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
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

function CallIntroFooter({ locked, onStart }: { locked: boolean; onStart: () => void }) {
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
    <TaskActions
      onFocus={preloadLiveCall}
      onPointerDown={preloadLiveCall}
      onPointerEnter={preloadLiveCall}
    >
      <TaskMainButton onClick={onStart}>
        <PhoneIcon aria-hidden="true" />
        {t("Start the call")}
      </TaskMainButton>
    </TaskActions>
  );
}

function CallIntro({
  conversation,
  exitHref,
  footer,
}: {
  conversation: LanguageConversationView;
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
