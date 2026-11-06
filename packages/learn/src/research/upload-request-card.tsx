"use client";

import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { FileSearchIcon, UploadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { AttachControls } from "../onboarding/entry/attach-panel";
import { type GoalAttachActions } from "../onboarding/onboarding-actions";

/** `alreadyRead`: research read these uploads for an earlier ask, so it needs a different one. */
export type UploadAnswer = "alreadyRead" | "answered" | "failed";

type UploadRequestActions = {
  answer: (sourceIds: string[]) => Promise<UploadAnswer>;
  attach: GoalAttachActions;
  dismiss: () => Promise<boolean>;
};

type CardState = "answered" | "asking" | "dismissed" | "uploading";

type Failure = Exclude<UploadAnswer, "answered">;

export function useRequestCopy({
  examDocument: document,
  goalKind,
  reason,
}: Pick<GoalUploadRequest, "examDocument" | "goalKind" | "reason">) {
  const t = useExtracted();

  if (reason === "classMaterial") {
    return {
      action: t("Upload your material"),
      body: t(
        "Your teacher's test isn't published anywhere. Upload the slides, notes or list of topics so your plan follows your class.",
      ),
      title: t("Add your class material"),
    };
  }

  if (goalKind !== "exam") {
    return {
      action: t("Upload a document"),
      body: t("Upload the official text or guide you study from so your lessons follow it."),
      title: t("We couldn't find the official source"),
    };
  }

  const action = t(
    "{document, select, notice {Upload the notice} other {Upload the official guide}}",
    { document },
  );

  if (reason === "unverified") {
    return {
      action,
      body: t(
        "{document, select, notice {What we found didn't match the exam's details. Upload the official notice so your plan follows the real exam.} other {What we found didn't match the exam's details. Upload the official guide so your plan follows the real exam.}}",
        { document },
      ),
      title: t("We couldn't confirm the exam's details"),
    };
  }

  return {
    action,
    body: t(
      "{document, select, notice {Upload the notice so your plan follows the real exam.} other {Upload the official guide so your plan follows the real exam.}}",
      { document },
    ),
    title: t(
      "{document, select, notice {We couldn't find the official notice} other {We couldn't find the official guide}}",
      { document },
    ),
  };
}

export function UploadRequestCard({
  actions,
  className,
  language,
  request,
}: {
  actions: UploadRequestActions;
  className?: string;
  language: string;
  request: Pick<GoalUploadRequest, "examDocument" | "goalKind" | "reason">;
}) {
  const t = useExtracted();
  const titleId = useId();
  const copy = useRequestCopy(request);
  const [state, setState] = useState<CardState>("asking");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<Failure | null>, done: CardState) =>
    startTransition(async () => {
      setFailure(null);
      const failed = await action().catch((): Failure => "failed");
      setFailure(failed);

      if (!failed) {
        setState(done);
      }
    });

  const answer = async (sourceId: string): Promise<Failure | null> => {
    const outcome = await actions.answer([sourceId]);
    return outcome === "answered" ? null : outcome;
  };

  if (state === "dismissed") {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn("bg-muted/60 flex flex-col gap-3 rounded-xl p-4", className)}
    >
      <div className="flex items-start gap-3">
        <FileSearchIcon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 size-5 shrink-0"
        />

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold" id={titleId}>
            {copy.title}
          </h2>

          <p className="text-muted-foreground text-sm leading-relaxed">{copy.body}</p>
        </div>
      </div>

      {state === "answered" && (
        <p className="text-sm" role="status">
          {t("Thanks. We're reading it now, and your plan will update in a few minutes.")}
        </p>
      )}

      {state === "asking" && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => setState("uploading")}
            size="sm"
            variant="outline"
          >
            <UploadIcon aria-hidden="true" />
            {copy.action}
          </Button>

          <Button
            disabled={isPending}
            focusableWhenDisabled
            onClick={() =>
              run(async () => ((await actions.dismiss()) ? null : "failed"), "dismissed")
            }
            size="sm"
            variant="ghost"
          >
            {t("Not now")}
          </Button>
        </div>
      )}

      {state === "uploading" && (
        <AttachControls
          attach={actions.attach}
          autoFocus
          language={language}
          onAttached={(source) => run(() => answer(source.id), "answered")}
        />
      )}

      {isPending && state === "uploading" && (
        <p aria-live="polite" className="flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-4" />
          {t("Sending it to be read…")}
        </p>
      )}

      {failure === "alreadyRead" && (
        <ChangeSaveError>
          {t("We already read this document. Upload a different one.")}
        </ChangeSaveError>
      )}

      {failure === "failed" && <ChangeSaveError />}
    </section>
  );
}
