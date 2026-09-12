"use client";

import { runClientAction } from "@/lib/client-action";
import { type getCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { reviseDiscovery } from "./discovery-actions";
import { DiscoveryStatusMessage } from "./discovery-feedback";

type Discovery = Extract<
  Awaited<ReturnType<typeof getCurrentUserCourseDiscovery>>,
  { status: "ready" }
>["discovery"];

function DiscoveryAnswer({
  answerIndex,
  canEdit,
  discovery,
  onUpdate,
}: {
  answerIndex: number;
  canEdit: boolean;
  discovery: Discovery;
  onUpdate: (next: Discovery, notice?: string) => void;
}) {
  const t = useExtracted();
  const answerId = useId();
  const answer = discovery.answers[answerIndex];
  const [editing, setEditing] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (!editing && wasEditing.current) {
      changeButtonRef.current?.focus();
    }

    wasEditing.current = editing;
  }, [editing]);

  if (!answer) {
    return null;
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    startTransition(async () => {
      const result = await runClientAction(
        () =>
          reviseDiscovery(discovery.id, {
            answerIndex,
            answerText,
            expectedRevision: discovery.revision,
          }),
        { status: "unavailable" as const },
      );

      if (result.status === "ready") {
        setEditing(false);
        onUpdate(result.discovery, "notice" in result ? result.notice : undefined);
      } else {
        setError(result.status);
      }
    });
  }

  return (
    <div>
      <dt className="font-medium">{answer.question}</dt>
      <dd className="text-muted-foreground mt-1 whitespace-pre-wrap">{answer.answer}</dd>
      {canEdit && !editing && (
        <Button
          aria-label={t("Change answer: {question}", { question: answer.question })}
          className="mt-1 min-h-11 px-0 underline underline-offset-4"
          onClick={() => {
            setEditing(true);
            setAnswerText(answer.answer);
            setError(undefined);
          }}
          size="sm"
          ref={changeButtonRef}
          variant="ghost"
        >
          {t("Change answer")}
        </Button>
      )}
      {editing && (
        <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
          <Label htmlFor={answerId}>{t("Your updated answer")}</Label>
          <Textarea
            autoFocus
            disabled={pending}
            id={answerId}
            maxLength={8000}
            onChange={(event) => setAnswerText(event.target.value)}
            required
            rows={3}
            value={answerText}
          />
          <p className="text-muted-foreground text-sm">
            {t("We'll revisit any later questions that depend on this answer.")}
          </p>
          {error && !pending && (
            <p className="text-destructive text-sm" role="alert">
              {error === "unavailable" ? (
                t("We couldn't update your answer. Your changes are still here. Try again.")
              ) : (
                <DiscoveryStatusMessage status={error} />
              )}
            </p>
          )}
          <div className="flex gap-3">
            <Button aria-busy={pending} disabled={pending} type="submit">
              {pending && <Spinner aria-hidden="true" />}
              {t("Update answer")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => setEditing(false)}
              type="button"
              variant="outline"
            >
              {t("Cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DiscoveryAnswers({
  discovery,
  onUpdate,
}: {
  discovery: Discovery;
  onUpdate: (next: Discovery, notice?: string) => void;
}) {
  const t = useExtracted();

  if (discovery.answers.length === 0) {
    return null;
  }

  const canEdit = !discovery.courseId && ["ask", "ready", "failed"].includes(discovery.status);

  return (
    <details className="text-sm">
      <summary className="text-muted-foreground cursor-pointer py-3">
        {canEdit ? t("Review or change your answers") : t("Your answers")}
      </summary>
      <dl className="flex flex-col gap-5 py-3">
        {discovery.answers.map((answer, index) => (
          <DiscoveryAnswer
            answerIndex={index}
            canEdit={canEdit}
            discovery={discovery}
            key={answer.questionId}
            onUpdate={onUpdate}
          />
        ))}
      </dl>
    </details>
  );
}
