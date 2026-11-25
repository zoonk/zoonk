"use client";

import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { Spinner } from "@zoonk/ui/components/spinner";
import { UploadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionResult,
  SuggestionSaveError,
  useMainActionVariant,
} from "../_components/suggestion";
import { AttachControls } from "../onboarding/entry/attach-panel";
import { useNoWordsHint } from "../onboarding/entry/attached-chips";
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

/**
 * Follows an answered upload until its read settles; `onUnreadable` once nothing on it could be read.
 * A read that failed is owed again when the same file answers again, so each answer is followed.
 */
export function useAnsweredUploadRead({
  answered,
  onUnreadable,
  read,
}: {
  answered: AttachedSource | null;
  onUnreadable: (source: AttachedSource) => void;
  read: GoalAttachActions["readStatus"];
}) {
  const [settledAnswer, setSettledAnswer] = useState<AttachedSource | null>(null);
  const following = answered && answered !== settledAnswer ? [answered] : [];

  useFollowReading({
    onSettled: (settled) => {
      const answeredRead = settled.find((item) => item.id === answered?.id);

      if (!answered || !answeredRead) {
        return;
      }

      setSettledAnswer(answered);

      if (answeredRead.readStatus === "unreadable") {
        onUnreadable(answered);
      }
    },
    read,
    sources: following,
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

/** The ask's words, what went wrong with the last upload, then the ways to answer it, all on one edge. */
export function UploadRequestCard({
  actions,
  language,
  request,
}: {
  actions: UploadRequestActions;
  language: string;
  request: UploadRequestView;
}) {
  const t = useExtracted();
  const copy = useRequestCopy(request);
  const noWordsHint = useNoWordsHint();
  const mainVariant = useMainActionVariant();
  const [state, setState] = useState<CardState>("asking");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [unreadable, setUnreadable] = useState<Unreadable | null>(request.unreadableUpload ?? null);
  const [isPending, startTransition] = useTransition();
  const hint = unreadable && state !== "answered" ? noWordsHint([unreadable]) : null;

  const dismiss = () =>
    startTransition(async () => {
      setFailure(null);
      const dismissed = await actions.dismiss().catch(() => false);

      if (dismissed) {
        setState("dismissed");
      } else {
        setFailure("failed");
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
    <>
      <SuggestionHeader>{copy.title}</SuggestionHeader>
      <SuggestionDescription>{copy.body}</SuggestionDescription>

      {hint && (
        <SuggestionDescription className="text-destructive-text" role="alert">
          {hint}
        </SuggestionDescription>
      )}

      {state === "answered" && (
        <SuggestionResult>
          {t("Thanks. We're reading it now, and your plan will update in a few minutes.")}
        </SuggestionResult>
      )}

      {state === "asking" && (
        <SuggestionActions
          main={
            <SuggestionAction
              disabled={isPending}
              icon={<UploadIcon aria-hidden="true" />}
              onClick={() => setState("uploading")}
              variant={mainVariant}
            >
              {copy.action}
            </SuggestionAction>
          }
        >
          <SuggestionAction action={dismiss} busy={isPending} variant="outline">
            {t("Not now")}
          </SuggestionAction>
        </SuggestionActions>
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

      {failure === "alreadyRead" && (
        <ChangeSaveError>
          {t("We already read this document. Upload a different one.")}
        </ChangeSaveError>
      )}

      {failure === "failed" && <SuggestionSaveError />}
    </>
  );
}
