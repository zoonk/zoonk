"use client";

import { Button } from "@zoonk/ui/components/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { buildLessonQuestionCopy } from "./lesson-question-copy";
import { type LessonQuestionPanelMetadata } from "./lesson-question-panel-types";
import { type LessonQuestionController } from "./use-lesson-questions";

export function LessonQuestionCopyAction({
  controller,
  metadata,
}: {
  controller: LessonQuestionController;
  metadata: LessonQuestionPanelMetadata;
}) {
  const t = useExtracted();
  const { state } = controller;

  const label = state.copied ? t("Copied") : t("Copy lesson content");

  const handleCopy = () => {
    const stepLabel =
      state.context.kind === "lesson"
        ? null
        : t("Part {current} of {total}", {
            current: String(state.context.stepIndex + 1),
            total: String(metadata.lessonSteps.length),
          });

    const lessonStepLabels = metadata.lessonSteps.map((_, index) =>
      t("Part {current} of {total}", {
        current: String(index + 1),
        total: String(metadata.lessonSteps.length),
      }),
    );

    const copyText = buildLessonQuestionCopy({
      chapterTitle: metadata.chapterTitle,
      context: state.context,
      courseTitle: metadata.courseTitle,
      labels: {
        audioExercise: t("Audio exercise"),
        correctAnswer: t("Correct answer"),
        currentStep: t("Currently viewing"),
        feedback: t("Feedback"),
        leftColumn: t("Left column"),
        options: t("Options"),
        question: t("My question"),
        rightColumn: t("Right column"),
        writeQuestion: t("[Write your question]"),
        yourAnswer: t("Your answer"),
      },
      lessonDescription: metadata.lessonDescription,
      lessonStepLabels,
      lessonSteps: metadata.lessonSteps,
      lessonTitle: metadata.lessonTitle,
      question: state.draft,
      stepLabel,
    });

    void controller.copy(copyText);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Button onClick={handleCopy} size="xs" type="button" variant="ghost">
        {state.copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {label}
      </Button>
      {state.error === "copy" && (
        <span className="text-destructive text-xs" role="alert">
          {t("Couldn't copy lesson content. Try again.")}
        </span>
      )}
    </div>
  );
}
