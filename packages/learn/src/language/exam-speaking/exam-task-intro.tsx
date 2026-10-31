"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type ExamTaskView } from "@zoonk/core/language/exam-speaking/contract";
import { InfoIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { Callout } from "../../_components/callout";
import { PageEyebrow } from "../../_components/page";
import { TaskAsideContent } from "../../_components/task-layout";
import { TaskFrame } from "../../shell/task-frame";
import { CharacterRow, MicNote } from "../conversation/conversation-parts";
import { useCriterionGloss, useTaskRoleNoun } from "./exam-speaking-labels";
import { PrepTimer } from "./prep-timer";
import { SpeakingCard } from "./speaking-card";
import { useTaskMinutes } from "./speaking-task-row";

export function useExamTaskTitle() {
  const t = useExtracted();

  return (examTask: Pick<ExamTaskView, "number" | "taskCount" | "title">) =>
    t("{exam} · Task {number} of {count}", {
      count: String(examTask.taskCount),
      exam: examTask.title,
      number: String(examTask.number),
    });
}

function StandInNote({ examTask, name }: { examTask: ExamTaskView; name: string }) {
  const t = useExtracted();

  return (
    <Callout>
      <InfoIcon aria-hidden="true" />
      <p>
        {examTask.task.role === "partner"
          ? t("{name} is an AI playing the other candidate, in place of a real one.", { name })
          : t("{name} is an AI standing in for a human examiner.", { name })}{" "}
        {t("It's practice: the estimate after it isn't an official score.")}
      </p>
    </Callout>
  );
}

export function ExamTaskIntro({
  conversation,
  examTask,
  exitHref,
  footer,
}: {
  conversation: LanguageConversationView;
  examTask: ExamTaskView;
  exitHref: string;
  footer: ReactNode;
}) {
  const t = useExtracted();
  const title = useExamTaskTitle();
  const minutes = useTaskMinutes();
  const roleNoun = useTaskRoleNoun();
  const gloss = useCriterionGloss();
  const format = useFormatter();
  const heading = useRef<HTMLHeadingElement>(null);
  const { character } = conversation;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <TaskFrame
      aside={{ label: t("Your card") }}
      closeOnEscape
      exitHref={exitHref}
      footer={footer}
      headerTitle={title(examTask)}
    >
      <header className="flex flex-col gap-2">
        <PageEyebrow>{minutes(examTask.task.minutes)}</PageEyebrow>
        <h1
          className="text-title text-balance outline-none"
          lang={conversation.targetLanguage}
          ref={heading}
          tabIndex={-1}
        >
          {examTask.task.name}
        </h1>
        <p className="text-pretty">{examTask.card.summary}</p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("{name} opens the call, and your card stays on screen.", { name: character.name })}{" "}
          {t("Rated on {criteria}.", {
            criteria: format.list(
              examTask.criteria.map((criterion) => gloss(criterion)),
              { type: "conjunction" },
            ),
          })}
        </p>
      </header>

      <CharacterRow detail={roleNoun(examTask.task.role)} name={character.name} />

      <StandInNote examTask={examTask} name={character.name} />

      {examTask.task.prepMinutes > 0 && <PrepTimer cardId={conversation.id} task={examTask.task} />}

      <TaskAsideContent className="w-full">
        <SpeakingCard card={examTask.card} language={conversation.targetLanguage} />
      </TaskAsideContent>

      <MicNote>
        {t(
          "Speak your answers: typed ones aren't rated on how you sound. The microphone is used only during the call.",
        )}
      </MicNote>
    </TaskFrame>
  );
}
