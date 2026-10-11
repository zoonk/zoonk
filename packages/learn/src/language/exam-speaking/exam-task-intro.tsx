"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type ExamTaskView } from "@zoonk/core/language/exam-speaking/contract";
import { ClockIcon, InfoIcon, MicIcon, PhoneIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useEffect, useRef } from "react";
import { Callout } from "../../_components/callout";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { CharacterAvatar } from "../conversation/conversation-parts";
import { useCriterionGloss, useTaskRoleNoun } from "./exam-speaking-labels";
import { PrepTimer } from "./prep-timer";
import { SpeakingCard } from "./speaking-card";
import { useTaskMinutes } from "./speaking-task-row";

/** "DELE B2 · Task 1 of 3", as the task's header names it. */
export function useExamTaskTitle() {
  const t = useExtracted();

  return (examTask: Pick<ExamTaskView, "number" | "taskCount" | "title">) =>
    t("{exam} · Task {number} of {count}", {
      count: String(examTask.taskCount),
      exam: examTask.title,
      number: String(examTask.number),
    });
}

/** That an AI plays the examiner or the other candidate in place of a person. */
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

/**
 * Before an exam task's call, as the exam room has it: who the learner talks to and the task's
 * official timing, that an AI stands in for the examiner or partner, what to do in the learner's
 * language, then the card itself in the exam's language with the preparation time the exam gives.
 * One button (or Enter) starts the call; Escape leaves, since nothing has started.
 */
export function ExamTaskIntro({
  conversation,
  examTask,
  exitHref,
  onStart,
}: {
  conversation: LanguageConversationView;
  examTask: ExamTaskView;
  exitHref: string;
  onStart: () => void;
}) {
  const t = useExtracted();
  const title = useExamTaskTitle();
  const minutes = useTaskMinutes();
  const roleNoun = useTaskRoleNoun();
  const gloss = useCriterionGloss();
  const format = useFormatter();
  const heading = useRef<HTMLHeadingElement>(null);
  const { character } = conversation;

  // The task opens on its name, so the keyboard and screen readers start where the eyes do.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <TaskFrame
      closeOnEscape
      exitHref={exitHref}
      footer={
        <>
          <p className="text-muted-foreground text-center text-xs text-balance">
            <MicIcon aria-hidden="true" className="me-1.5 inline size-3.5 align-[-0.2em]" />
            {t(
              "Speak your answers: typed ones aren't rated on how you sound. The microphone is used only during the call.",
            )}
          </p>
          <TaskMainButton onClick={onStart}>
            <PhoneIcon aria-hidden="true" />
            {t("Start the call")}
          </TaskMainButton>
        </>
      }
      headerTitle={title(examTask)}
    >
      <section className="flex flex-col items-center gap-4 text-center">
        <CharacterAvatar name={character.name} size="lg" />
        <div className="flex flex-col items-center gap-1.5">
          <h1
            className="text-2xl font-bold tracking-tight text-balance outline-none"
            lang={conversation.targetLanguage}
            ref={heading}
            tabIndex={-1}
          >
            {examTask.task.name}
          </h1>
          {/* Every task happens in the exam room, so its place says nothing; the role says who. */}
          <p className="text-muted-foreground text-balance">
            {t("{name} · {role}", { name: character.name, role: roleNoun(examTask.task.role) })}
          </p>
        </div>
        <FactChips className="justify-center">
          <FactChip>
            <ClockIcon aria-hidden="true" />
            {minutes(examTask.task.minutes)}
          </FactChip>
        </FactChips>
      </section>

      <StandInNote examTask={examTask} name={character.name} />

      <div className="flex flex-col gap-1.5">
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
      </div>

      {examTask.task.prepMinutes > 0 && <PrepTimer cardId={conversation.id} task={examTask.task} />}

      <SpeakingCard card={examTask.card} language={conversation.targetLanguage} />
    </TaskFrame>
  );
}
