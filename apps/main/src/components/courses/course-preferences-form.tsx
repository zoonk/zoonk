"use client";

import { runClientAction } from "@/lib/client-action";
import { type CoursePlanInput } from "@zoonk/core/courses/learning-plan-contract";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
} from "@zoonk/ui/components/questionnaire";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  CourseDailyPaceQuestion,
  LanguageActivitiesQuestion,
  LanguageActivityModeQuestion,
} from "./course-preference-questions";

type PreferenceOutcome =
  | { error: "conflict" | "invalid" | "unavailable" | "limitReached" }
  | undefined;

export function CoursePreferencesForm({
  defaultInput,
  isLanguage,
  onSave,
}: {
  defaultInput: CoursePlanInput;
  isLanguage: boolean;
  onSave: (
    input: Pick<CoursePlanInput, "dailyMinutes" | "hiddenLessonKinds">,
  ) => Promise<PreferenceOutcome>;
}) {
  const t = useExtracted();
  const [dailyMinutes, setDailyMinutes] = useState(String(defaultInput.dailyMinutes ?? "none"));
  const [hiddenKinds, setHiddenKinds] = useState(defaultInput.hiddenLessonKinds ?? []);

  const [mode, setMode] = useState<"recommended" | "custom">(
    hiddenKinds.length > 0 ? "custom" : "recommended",
  );

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<PreferenceOutcome>();

  const items = [
    { name: "dailyMinutes", required: true },
    isLanguage && { name: "activityMode", required: true },
    isLanguage && mode === "custom" && { multiple: true, name: "activities", required: true },
  ].filter((item) => item !== false);

  return (
    <Questionnaire
      items={items}
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);

        startTransition(async () => {
          const result = await runClientAction(
            () =>
              onSave({
                dailyMinutes: dailyMinutes === "none" ? null : Number(dailyMinutes),
                hiddenLessonKinds: isLanguage && mode === "recommended" ? [] : hiddenKinds,
              }),
            { error: "unavailable" as const },
          );

          setError(result);
        });
      }}
    >
      <CourseDailyPaceQuestion disabled={pending} onChange={setDailyMinutes} value={dailyMinutes} />
      {isLanguage && (
        <LanguageActivityModeQuestion disabled={pending} onChange={setMode} value={mode} />
      )}
      {isLanguage && mode === "custom" && (
        <LanguageActivitiesQuestion
          disabled={pending}
          hiddenKinds={hiddenKinds}
          onChange={setHiddenKinds}
        />
      )}
      {error && !pending && (
        <p className="text-destructive text-sm" role="alert">
          <CoursePreferenceError error={error.error} />
        </p>
      )}
      <QuestionnaireActions>
        <QuestionnairePrevious disabled={pending}>{t("Back")}</QuestionnairePrevious>
        <QuestionnaireNext disabled={pending}>{t("Continue")}</QuestionnaireNext>
        <QuestionnaireSubmit aria-busy={pending} disabled={pending}>
          {pending && <Spinner aria-hidden="true" />}
          {t("Save changes")}
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}

function CoursePreferenceError({ error }: { error: NonNullable<PreferenceOutcome>["error"] }) {
  const t = useExtracted();

  if (error === "invalid") {
    return t("Keep an activity that's available in your path, or use the recommended activities.");
  }

  if (error === "limitReached") {
    return t(
      "Your course needs an updated learning plan. You can request more plans tomorrow; your current path is still available.",
    );
  }

  if (error === "conflict") {
    return t(
      "Your learning path changed in another tab. Reload this page to edit its latest preferences.",
    );
  }

  return t("We couldn't save your preferences. Your choices are still here. Try again.");
}
