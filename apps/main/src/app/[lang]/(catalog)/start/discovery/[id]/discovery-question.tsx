"use client";

import { runClientAction } from "@/lib/client-action";
import { type getCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { type DiscoveryAnswerInput } from "@zoonk/core/courses/discovery-contract";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@zoonk/ui/components/questionnaire";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { answerDiscovery } from "./discovery-actions";
import { DiscoveryStatusMessage } from "./discovery-feedback";

type Discovery = Extract<
  Awaited<ReturnType<typeof getCurrentUserCourseDiscovery>>,
  { status: "ready" }
>["discovery"];

const OPTION_VALUE_PREFIX = "option:";

export function DiscoveryQuestion({
  discovery,
  onUpdate,
}: {
  discovery: Discovery;
  onUpdate: (next: Discovery, notice?: string) => void;
}) {
  const t = useExtracted();
  const otherId = useId();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState("");
  const [otherAnswer, setOtherAnswer] = useState("");
  const [error, setError] = useState<string>();
  const question = discovery.question;

  useEffect(() => {
    fieldsetRef.current?.focus();
  }, []);

  if (!question) {
    return null;
  }

  function submit(skip = false) {
    if (!question) {
      return;
    }

    setError(undefined);

    startTransition(async () => {
      const result = await runClientAction(
        () =>
          answerDiscovery(discovery.id, {
            expectedRevision: discovery.revision,
            questionId: question.id,
            ...getAnswer({ choice, otherAnswer, skip }),
          }),
        { status: "unavailable" as const },
      );

      if (result.status === "ready") {
        onUpdate(result.discovery, "notice" in result ? result.notice : undefined);
      } else {
        setError(result.status);
      }
    });
  }

  return (
    <Questionnaire
      items={[{ name: "answer", required: true }]}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <QuestionnaireItem name="answer" ref={fieldsetRef} required tabIndex={-1}>
        <QuestionnaireTitle className="text-2xl tracking-tight">
          {question.question}
        </QuestionnaireTitle>
        <QuestionnaireDescription>{question.description}</QuestionnaireDescription>
        <QuestionnaireChoices>
          {question.options.map((option) => (
            <QuestionnaireChoice
              checked={choice === `${OPTION_VALUE_PREFIX}${option.id}`}
              disabled={pending}
              key={option.id}
              onChange={() => setChoice(`${OPTION_VALUE_PREFIX}${option.id}`)}
              value={`${OPTION_VALUE_PREFIX}${option.id}`}
            >
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <QuestionnaireChoiceDescription>
                  {option.description}
                </QuestionnaireChoiceDescription>
              )}
            </QuestionnaireChoice>
          ))}
          <QuestionnaireChoice
            checked={choice === "other"}
            disabled={pending}
            onChange={() => setChoice("other")}
            value="other"
          >
            {t("Something else")}
          </QuestionnaireChoice>
        </QuestionnaireChoices>
        {choice === "other" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={otherId}>{t("Tell us what you have in mind")}</Label>
            <QuestionnaireInput
              disabled={pending}
              id={otherId}
              maxLength={8000}
              onChange={(event) => setOtherAnswer(event.target.value)}
              required
              value={otherAnswer}
            />
          </div>
        )}
        {!pending && (
          <QuestionnaireError>
            {t("Choose an answer or add your own to continue.")}
          </QuestionnaireError>
        )}
      </QuestionnaireItem>
      {error && !pending && (
        <p className="text-destructive text-sm" role="alert">
          <DiscoveryStatusMessage status={error} />
        </p>
      )}
      <QuestionnaireActions>
        {question.optional && (
          <Button
            className="col-start-1 w-fit"
            disabled={pending}
            onClick={() => submit(true)}
            type="button"
            variant="ghost"
          >
            {t("No preference")}
          </Button>
        )}
        <QuestionnaireSubmit aria-busy={pending} disabled={pending}>
          {pending && <Spinner aria-hidden="true" />}
          {t("Continue")}
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}

function getAnswer({
  choice,
  otherAnswer,
  skip,
}: {
  choice: string;
  otherAnswer: string;
  skip: boolean;
}): Pick<DiscoveryAnswerInput, "optionId" | "otherAnswer" | "skip"> {
  if (skip) {
    return { skip: true };
  }

  if (choice === "other") {
    return { otherAnswer };
  }

  return { optionId: choice.slice(OPTION_VALUE_PREFIX.length) };
}
