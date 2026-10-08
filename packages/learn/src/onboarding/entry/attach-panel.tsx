"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { FileTextIcon, LinkIcon, UploadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { LearnLink } from "../../learn-link";
import {
  type AttachOutcome,
  type AttachedSource,
  type GoalAttachActions,
  type UsageCap,
} from "../onboarding-actions";
import { PasteLink } from "./paste-link";

/** What the uploads route reads: PDFs, Word, PowerPoint, text, Markdown and photos. */
const ACCEPTED_FILES =
  ".pdf,.docx,.pptx,.txt,.md,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp";

const PANEL_CLASS = "bg-card ring-foreground/10 flex flex-col gap-3 rounded-3xl p-4 ring-1";

/** The plan's cap on new material: the day's or the month's, with Plus for a free learner. */
function useAttachLimitMessage() {
  const t = useExtracted();

  return ({ period, tier }: UsageCap): string => {
    if (tier === "plus") {
      return t("You've added as much material as your plan allows today. Try again tomorrow.");
    }

    return period === "month"
      ? t(
          "You've added as much material as the free plan allows this month. Try again next month, or get Plus to keep going now.",
        )
      : t(
          "You've added as much material as the free plan allows today. Try again tomorrow, or get Plus to keep going now.",
        );
  };
}

function useAttachError() {
  const t = useExtracted();
  const limitMessage = useAttachLimitMessage();

  return (outcome: Exclude<AttachOutcome, { status: "attached" }>): string => {
    switch (outcome.status) {
      case "limitReached":
        return limitMessage(outcome);
      case "slowDown":
        return t("You're adding material quickly. Try again in a few minutes.");
      case "unsupported":
        return t("We can't read this file. Try a PDF, a photo, Word, PowerPoint or text.");
      case "signInRequired":
        return t("Create an account to add your own material.");
      case "failed":
        return t("We couldn't add that. Try again in a moment.");
      default:
        return t("We couldn't add that. Try again in a moment.");
    }
  };
}

/** Guests and visitors: their material needs an account, so the paperclip says how to get one. */
export function SignUpPrompt({ signUpHref }: { signUpHref: string }) {
  const t = useExtracted();

  return (
    <div className={PANEL_CLASS}>
      <p className="font-medium">{t("Study your own material")}</p>
      <p className="text-muted-foreground text-sm">
        {t("Create a free account to add a PDF, a photo of your notes or any text to your goal.")}
      </p>
      <LearnLink
        className="text-foreground self-start text-sm font-medium underline underline-offset-4"
        href={signUpHref}
      >
        {t("Create an account")}
      </LearnLink>
    </div>
  );
}

function PasteText({ onAdd, pending }: { onAdd: (text: string) => void; pending: boolean }) {
  const t = useExtracted();
  const inputId = useId();
  const [text, setText] = useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (text.trim()) {
          onAdd(text.trim());
        }
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {t("Your text")}
      </label>
      <Textarea
        autoFocus
        className="max-h-60 min-h-24"
        id={inputId}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("Paste the syllabus, your notes or a chapter")}
        value={text}
      />
      <Button className="self-start" disabled={pending || !text.trim()} size="sm" type="submit">
        {t("Add text")}
      </Button>
    </form>
  );
}

type AttachControlsProps = {
  attach: GoalAttachActions;
  language: string;
  onAttached: (source: AttachedSource) => void;
};

/**
 * The ways to add material: upload a file, or paste text or a link, with the pending and error
 * states. The onboarding paperclip wraps them in its panel; other screens that ask for a document
 * (the notice research couldn't find) put them under their own words.
 */
export function AttachControls({ attach, language, onAttached }: AttachControlsProps) {
  const t = useExtracted();
  const fileId = useId();
  const errorFor = useAttachError();
  const [pasting, setPasting] = useState<"link" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Another way to add it is a new try: the last one's error is about something else.
  const toggle = (way: "link" | "text") => {
    setError(null);
    setPasting((previous) => (previous === way ? null : way));
  };

  const add = (run: () => Promise<AttachOutcome>) =>
    startTransition(async () => {
      setError(null);
      const outcome = await run();

      if (outcome.status === "attached") {
        setPasting(null);
        onAttached(outcome.source);
        return;
      }

      setError(errorFor(outcome));
    });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <label
          className="border-border hover:bg-muted/60 has-focus-visible:ring-ring/50 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium has-focus-visible:ring-[3px]"
          htmlFor={fileId}
        >
          <UploadIcon aria-hidden="true" className="size-4" />
          {t("Upload a file")}
          <input
            accept={ACCEPTED_FILES}
            className="sr-only"
            disabled={isPending}
            id={fileId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (file) {
                add(() => attach.file({ file, language }));
              }
            }}
            type="file"
          />
        </label>

        <Button
          aria-pressed={pasting === "text"}
          className="rounded-full"
          disabled={isPending}
          onClick={() => toggle("text")}
          size="sm"
          variant="outline"
        >
          <FileTextIcon aria-hidden="true" />
          {t("Paste text")}
        </Button>

        <Button
          aria-pressed={pasting === "link"}
          className="rounded-full"
          disabled={isPending}
          onClick={() => toggle("link")}
          size="sm"
          variant="outline"
        >
          <LinkIcon aria-hidden="true" />
          {t("Paste a link")}
        </Button>
      </div>

      {pasting === "text" && (
        <PasteText
          onAdd={(text) => add(() => attach.text({ language, text }))}
          pending={isPending}
        />
      )}

      {pasting === "link" && (
        <PasteLink onAdd={(url) => add(() => attach.link({ language, url }))} pending={isPending} />
      )}

      {isPending && (
        <p aria-live="polite" className="flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-4" />
          {t("Adding your material…")}
        </p>
      )}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** Upload a file, or paste text or a link; each becomes a chip on the goal. */
export function AttachPanel(props: AttachControlsProps) {
  const t = useExtracted();

  return (
    <div className={PANEL_CLASS}>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{t("Study your own material")}</p>
        <p className="text-muted-foreground text-sm">{t("Your plan and lessons will use it.")}</p>
      </div>

      <AttachControls {...props} />
    </div>
  );
}
