"use client";

import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { FileSearchIcon, UploadIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { AttachControls } from "../onboarding/entry/attach-panel";
import { UnreadableNote, useNoWordsHint } from "../onboarding/entry/attached-chips";
import { useFollowReading } from "../onboarding/entry/use-follow-reading";
import { type AttachedSource, type GoalAttachActions } from "../onboarding/onboarding-actions";

/**
 * `alreadyRead`: research read these uploads for an earlier ask, so it needs a different one.
 * `unreadable`: nothing on the upload could be read, so the ask stays open.
 */
export type UploadAnswer = "alreadyRead" | "answered" | "failed" | "unreadable";

export type UploadRequestView = Pick<GoalUploadRequest, "examDocument" | "goalKind" | "reason"> & {
  /** The upload that answered this ask last, when nothing on it could be read. */
  unreadableUpload?: { title: string } | null;
};

type UploadRequestActions = {
  answer: (source: AttachedSource) => Promise<UploadAnswer>;
  attach: GoalAttachActions;
  dismiss: () => Promise<boolean>;
};

type CardState = "answered" | "asking" | "dismissed" | "uploading";

type Failure = Exclude<UploadAnswer, "answered" | "unreadable">;

type Unreadable = Pick<AttachedSource, "title">;

/** While an answered upload is still being read; `onUnreadable` once nothing on it could be read. */
export function useAnsweredUploadRead({
  answered,
  onUnreadable,
  read,
}: {
  answered: AttachedSource | null;
  onUnreadable: (source: AttachedSource) => void;
  read: GoalAttachActions["readStatus"];
}) {
  useFollowReading({
    onSettled: (settled) => {
      if (
        answered &&
        settled.some((item) => item.id === answered.id && item.readStatus === "unreadable")
      ) {
        onUnreadable(answered);
      }
    },
    read,
    sources: answered ? [answered] : [],
  });
}

/** `summary` is the one line that stands for the request; it says when the last upload couldn't be read. */
export function useRequestCopy(request: UploadRequestView) {
  const noWordsHint = useNoWordsHint();
  const copy = useAskCopy(request);
  const hint = request.unreadableUpload ? noWordsHint([request.unreadableUpload]) : null;

  return { ...copy, summary: hint ?? copy.title };
}

function useAskCopy({
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
  request: UploadRequestView;
}) {
  const t = useExtracted();
  const titleId = useId();
  const copy = useRequestCopy(request);
  const [state, setState] = useState<CardState>("asking");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [unreadable, setUnreadable] = useState<Unreadable | null>(request.unreadableUpload ?? null);
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

  const backToAsking = (source: Unreadable) => {
    setUnreadable(source);
    setState("asking");
  };

  /** Nothing to read on it: answering would only bring the ask back. */
  const attached = (source: AttachedSource) =>
    startTransition(async () => {
      setFailure(null);
      setUnreadable(null);

      if (source.readStatus === "unreadable") {
        backToAsking(source);
        return;
      }

      const outcome = await actions.answer(source).catch((): UploadAnswer => "failed");

      if (outcome === "unreadable") {
        backToAsking(source);
      } else if (outcome === "answered") {
        setState("answered");
      } else {
        setFailure(outcome);
      }
    });

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
        <form className="flex flex-wrap gap-2">
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
            busy={isPending}
            formAction={() =>
              run(async () => ((await actions.dismiss()) ? null : "failed"), "dismissed")
            }
            icon={<XIcon aria-hidden="true" />}
            size="sm"
            type="submit"
            variant="ghost"
          >
            {t("Not now")}
          </Button>
        </form>
      )}

      {state === "uploading" && (
        <AttachControls
          attach={actions.attach}
          autoFocus
          language={language}
          onAttached={attached}
        />
      )}

      {isPending && state === "uploading" && (
        <p aria-live="polite" className="flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-4" />
          {t("Sending it to be read…")}
        </p>
      )}

      {unreadable && state !== "answered" && (
        <UnreadableNote items={[{ ...unreadable, id: "", readStatus: "unreadable" }]} />
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
