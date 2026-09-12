"use client";

import { runClientAction } from "@/lib/client-action";
import { type CoursePlanInput } from "@zoonk/core/courses/learning-plan-contract";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@zoonk/ui/components/questionnaire";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  CoreStartingPoint,
  CourseGoalDetail,
  CourseLearningGoal,
  LanguageStartingPoint,
} from "./course-setup-questions";
import { useCourseSetupDraft } from "./use-course-setup-draft";

type SetupOutcome = { error: "invalid" | "unavailable" | "conflict" | "limitReached" } | undefined;

export function CourseSetupForm({
  courseId,
  defaultInput,
  format,
  onStart,
}: {
  courseId: string;
  defaultInput?: CoursePlanInput;
  format: "core" | "language";
  onStart: (formData: FormData) => Promise<SetupOutcome>;
}) {
  const t = useExtracted();

  const { draft, updateDraft } = useCourseSetupDraft({ courseId, defaultInput });
  const { depth, goal, goalDetail, startingLevel } = draft;
  const [error, setError] = useState<SetupOutcome>();
  const [pending, startTransition] = useTransition();
  const isLanguage = format === "language";
  const isFocused = depth === "focused" && !isLanguage;
  const needsStartingLevel = depth !== "overview" && depth !== undefined;
  const needsGoalDetail = isFocused && ["work", "project", "study"].includes(goal);

  const choices = [
    {
      description: t("Understand the main ideas through everyday examples."),
      title: t("Get an overview"),
      value: "overview" as const,
    },
    {
      description: t("Learn step by step, from the basics to advanced ideas."),
      title: t("Explore the full subject"),
      value: "complete" as const,
    },
    {
      description: t("Focus on what you want to be able to do."),
      title: t("Work toward a goal"),
      value: "focused" as const,
    },
  ];

  const items = [
    !isLanguage && { choices, name: "depth", required: true },
    isFocused && { name: "goal", required: true },
    needsGoalDetail && { name: "goalDetail", required: true },
    (isLanguage || needsStartingLevel) && { name: "startingLevel", required: true },
  ].filter((item) => item !== false);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("depth", isLanguage ? "complete" : (depth ?? "overview"));

    const goalDescriptions: Record<string, string> = {
      project: t("Build a project using this subject: {goal}", { goal: goalDetail }),
      study: t("Prepare for further study: {goal}", { goal: goalDetail }),
      work: t("Use this subject in my work: {goal}", { goal: goalDetail }),
    };

    const focusedGoal = goalDescriptions[goal] ?? goal;
    formData.set("goal", depth === "focused" ? focusedGoal : "");
    formData.set("startingLevel", startingLevel);
    setError(undefined);

    startTransition(async () => {
      setError(await runClientAction(() => onStart(formData), { error: "unavailable" as const }));
    });
  }

  return (
    <Questionnaire className="gap-7" items={items} onSubmit={handleSubmit}>
      {!isLanguage && (
        <QuestionnaireItem name="depth" required>
          <QuestionnaireTitle className="text-2xl tracking-tight">
            {t("How would you like to learn?")}
          </QuestionnaireTitle>
          <QuestionnaireDescription>
            {t("Start with what you need today. The full course will always be here.")}
          </QuestionnaireDescription>
          <QuestionnaireChoices>
            {choices.map((choice) => (
              <QuestionnaireChoice
                checked={depth === choice.value}
                disabled={pending}
                key={choice.value}
                onChange={() => updateDraft({ depth: choice.value })}
                value={choice.value}
              >
                <span className="font-medium">{choice.title}</span>
                <QuestionnaireChoiceDescription>
                  {choice.description}
                </QuestionnaireChoiceDescription>
              </QuestionnaireChoice>
            ))}
          </QuestionnaireChoices>
          {!pending && (
            <QuestionnaireError>{t("Choose an option to continue.")}</QuestionnaireError>
          )}
        </QuestionnaireItem>
      )}
      {isFocused && (
        <CourseLearningGoal
          disabled={pending}
          onChange={(value) => updateDraft({ goal: value })}
          value={goal}
        />
      )}
      {isLanguage && (
        <LanguageStartingPoint
          disabled={pending}
          onChange={(value) => updateDraft({ startingLevel: value })}
          value={startingLevel}
        />
      )}
      {needsGoalDetail && (
        <CourseGoalDetail
          disabled={pending}
          goal={goal}
          onChange={(value) => updateDraft({ goalDetail: value })}
          value={goalDetail}
        />
      )}
      {!isLanguage && needsStartingLevel && (
        <CoreStartingPoint
          disabled={pending}
          onChange={(value) => updateDraft({ startingLevel: value })}
          value={startingLevel}
        />
      )}
      {error && !pending && (
        <p className="text-destructive text-sm" role="alert">
          <CourseSetupError error={error.error} />
        </p>
      )}
      <QuestionnaireActions>
        <QuestionnairePrevious disabled={pending}>{t("Back")}</QuestionnairePrevious>
        <QuestionnaireNext disabled={pending}>{t("Continue")}</QuestionnaireNext>
        <QuestionnaireSubmit aria-busy={pending} disabled={pending}>
          {pending && <Spinner aria-hidden="true" />}
          {pending ? t("Preparing your next step…") : t("Start learning")}
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}

function CourseSetupError({ error }: { error: NonNullable<SetupOutcome>["error"] }) {
  const t = useExtracted();

  if (error === "limitReached") {
    return t(
      "You've reached today's limit for new learning plans. Your choices are saved in this browser. Try again tomorrow, or keep learning from your current path.",
    );
  }

  if (error === "conflict") {
    return t("Your course changed while you were choosing. Refresh the page and try again.");
  }

  return t("We couldn't save your choices. Please try again.");
}
