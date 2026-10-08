"use client";

import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { FileSearchIcon, UploadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { AttachControls } from "../onboarding/entry/attach-panel";
import { type GoalAttachActions } from "../onboarding/onboarding-actions";

/**
 * How the host answers the ask, already bound to the goal: uploads through its uploads API, then
 * research with them, or dismissing it.
 */
type UploadRequestActions = {
  answer: (sourceIds: string[]) => Promise<boolean>;
  attach: GoalAttachActions;
  dismiss: () => Promise<boolean>;
};

type CardState = "answered" | "asking" | "dismissed" | "uploading";

/** What's missing, in the goal's own terms: an exam's notice, a law's text, a class's material. */
function useRequestCopy({ goalKind, reason }: Pick<GoalUploadRequest, "goalKind" | "reason">) {
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

  if (reason === "unverified") {
    return {
      action: t("Upload the notice"),
      body: t(
        "What we found didn't match the exam's details. Upload the official notice so your plan follows the real exam.",
      ),
      title: t("We couldn't confirm the exam's details"),
    };
  }

  return {
    action: t("Upload the notice"),
    body: t("Upload it so your plan follows the real exam."),
    title: t("We couldn't find the official notice"),
  };
}

/**
 * Research couldn't find (or confirm) what the goal is built from, and it never guesses an
 * exam's structure: Today asks the learner for the document. Uploading it
 * answers at once and research reads it; the plan is rebuilt from it a few minutes later.
 * "Not now" takes the ask away for good.
 */
export function UploadRequestCard({
  actions,
  className,
  language,
  request,
}: {
  actions: UploadRequestActions;
  className?: string;
  /** The learner's language, for uploads that don't say their own. */
  language: string;
  request: Pick<GoalUploadRequest, "goalKind" | "reason">;
}) {
  const t = useExtracted();
  const titleId = useId();
  const copy = useRequestCopy(request);
  const [state, setState] = useState<CardState>("asking");
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<boolean>, done: CardState) =>
    startTransition(async () => {
      setFailed(false);
      const saved = await action();
      setFailed(!saved);

      if (saved) {
        setState(done);
      }
    });

  if (state === "dismissed") {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn("bg-muted/60 flex flex-col gap-3 rounded-2xl p-4", className)}
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
            onClick={() => setState("uploading")}
            size="sm"
            variant="outline"
          >
            <UploadIcon aria-hidden="true" />
            {copy.action}
          </Button>

          <Button
            disabled={isPending}
            onClick={() => run(actions.dismiss, "dismissed")}
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
          language={language}
          onAttached={(source) => run(() => actions.answer([source.id]), "answered")}
        />
      )}

      {isPending && state === "uploading" && (
        <p aria-live="polite" className="flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-4" />
          {t("Sending it to be read…")}
        </p>
      )}

      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't save that. Try again.")}
        </p>
      )}
    </section>
  );
}
