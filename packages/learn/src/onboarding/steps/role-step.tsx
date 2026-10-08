"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { StepForm } from "./step-form";
import { TextField } from "./text-field";

type RoleStepProps = {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  purpose: "careerChange" | "work";
};

/** An answer the learner left empty is skipped, not saved. */
function answer(value: string): string | null {
  return value.trim() || null;
}

/**
 * Work plans use cases from the learner's job, so they ask the role and what it's for there. A
 * career change asks where they are and the role they want: the plan is what that role needs.
 */
export function RoleStep({ onAnswer, pending, purpose }: RoleStepProps) {
  const t = useExtracted();
  const [role, setRole] = useState("");
  const [second, setSecond] = useState("");
  const isCareerChange = purpose === "careerChange";

  return (
    <StepForm
      canContinue={(isCareerChange ? second : role).trim().length > 0}
      description={
        isCareerChange
          ? t("The plan covers what that role needs on day one.")
          : t("We'll use cases from your work.")
      }
      onContinue={() =>
        onAnswer(
          isCareerChange
            ? { question: "role", role: answer(role), targetPosition: answer(second) }
            : { question: "role", role: answer(role), tasks: answer(second) },
        )
      }
      onSkip={() => onAnswer({ question: "role", role: null })}
      pending={pending}
      title={isCareerChange ? t("Where are you headed?") : t("What do you do at work?")}
    >
      {isCareerChange ? (
        <>
          <TextField
            label={t("The role you want")}
            onChange={setSecond}
            placeholder={t("E.g., data analyst, nurse")}
            value={second}
          />
          <TextField
            autoFocus={false}
            label={t("What you do now")}
            onChange={setRole}
            placeholder={t("E.g., teacher, student")}
            value={role}
          />
        </>
      ) : (
        <>
          <TextField
            label={t("Your role")}
            onChange={setRole}
            placeholder={t("E.g., nurse, teacher")}
            value={role}
          />
          <TextField
            autoFocus={false}
            label={t("What you'll use it for")}
            onChange={setSecond}
            placeholder={t("E.g., reports, A/B tests")}
            value={second}
          />
        </>
      )}
    </StepForm>
  );
}
