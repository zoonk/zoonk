"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type ExamTaskView } from "@zoonk/core/language/exam-speaking/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { Eyebrow } from "../../_components/eyebrow";
import { TaskAsideContent } from "../../_components/task-layout";
import { TaskFrame } from "../../shell/task-frame";
import { CharacterRow, SoundNote } from "../conversation/conversation-parts";
import { useTaskRoleNoun } from "./exam-speaking-labels";
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
  const heading = useRef<HTMLHeadingElement>(null);
  const { character } = conversation;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <TaskFrame
      aside={{ label: t("Your card") }}
      exitHref={exitHref}
      footer={footer}
      headerTitle={title(examTask)}
    >
      <header className="flex flex-col gap-2">
        <Eyebrow className="mb-1">{minutes(examTask.task.minutes)}</Eyebrow>
        <h1
          className="text-title text-balance outline-none"
          lang={conversation.targetLanguage}
          ref={heading}
          tabIndex={-1}
        >
          {examTask.task.name}
        </h1>
        <p className="text-pretty">{examTask.card.summary}</p>
      </header>

      <CharacterRow detail={roleNoun(examTask.task.role)} name={character.name} />

      {examTask.task.prepMinutes > 0 && <PrepTimer cardId={conversation.id} task={examTask.task} />}

      <TaskAsideContent className="w-full">
        <SpeakingCard card={examTask.card} language={conversation.targetLanguage} />
      </TaskAsideContent>

      <SoundNote />
    </TaskFrame>
  );
}
