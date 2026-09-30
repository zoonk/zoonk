"use client";

import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { ItemLine, ItemText } from "../questions/item-text";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import {
  type EssayActions,
  type EssayHrefs,
  EssayScreenProvider,
  useEssayScreen,
} from "./essay-context";
import { EssayFeedback } from "./essay-feedback";

export type { EssayActions } from "./essay-context";

type Status = "error" | "idle" | "limitReached" | "pending";

const WORD_PATTERN = /\S+/gu;

function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

/**
 * Grading an essay takes about 9 seconds (Flash, 17 s at most in its eval; a fallback model takes
 * up to 24 s): past `slowMs` the screen says it's still grading, and past `timeoutMs` it stops
 * waiting and lets the learner send it again, with the text kept.
 */
const GRADING_BOUNDS = { slowMs: 20_000, timeoutMs: 90_000 } as const;

function StatusLine({ status }: { status: Status }) {
  const t = useExtracted();
  const isSlow = useTakingLong({ active: status === "pending", afterMs: GRADING_BOUNDS.slowMs });

  if (status === "error") {
    return (
      <p className="text-destructive text-center text-sm" role="alert">
        {t("That didn't go through. Your text is still here. Try again in a moment.")}
      </p>
    );
  }

  if (status === "limitReached") {
    return (
      <p className="text-muted-foreground text-center text-sm" role="alert">
        {t("You've used today's essay grades. Your text is kept here; send it again tomorrow.")}
      </p>
    );
  }

  // Grading takes about ten seconds, so the learner knows it's working and roughly for how long.
  if (status === "pending") {
    return (
      <p className="text-muted-foreground text-center text-sm" role="status">
        {isSlow
          ? t("Still grading. This is taking longer than usual.")
          : t("Reading your essay against each criterion. It takes about 10 seconds.")}
      </p>
    );
  }

  return null;
}

function EssayWriter({ onGraded }: { onGraded: (draft: EssayDraft) => void }) {
  const t = useExtracted();
  const textId = useId();
  const { actions, drafts, essay } = useEssayScreen();
  const [text, setText] = useState(drafts[0]?.text ?? "");
  const [status, setStatus] = useState<Status>("idle");
  // Writing time runs from the first keystroke, not from when the screen opened.
  const startedAt = useRef<number | null>(null);
  const words = countWords(text);

  async function send() {
    setStatus("pending");

    const durationMs = startedAt.current === null ? 0 : Date.now() - startedAt.current;

    // A request that fails outright or takes too long reads as "couldn't grade": the text stays
    // and Send works again.
    const settled = await settleWithin({
      ms: GRADING_BOUNDS.timeoutMs,
      request: () => actions.submit({ durationMs, text }),
    }).catch(() => null);

    const result = settled?.status === "settled" ? settled.value : null;

    if (result === "limitReached" || result === null) {
      setStatus(result === null ? "error" : "limitReached");
      return;
    }

    setStatus("idle");
    startedAt.current = null;
    onGraded(result);
  }

  return (
    <section className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor={textId}>
        {drafts.length > 0 ? t("Rewrite what needs work") : t("Your essay")}
      </label>
      <Textarea
        className="in-data-[mode=fun]:fun-paper min-h-72 font-serif text-base leading-relaxed"
        id={textId}
        onChange={(event) => {
          startedAt.current ??= Date.now();
          setText(event.target.value);
        }}
        value={text}
      />
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        {t("{count, plural, one {# word} other {# words}}", { count: words })}
      </p>
      <StatusLine status={status} />
      <Button
        className={status === "pending" ? "disabled:opacity-100" : undefined}
        disabled={words === 0 || status === "pending" || essay.gradesLeft === 0}
        onClick={() => void send()}
        size="lg"
        variant={drafts.length > 0 ? "outline" : "default"}
      >
        {status === "pending" && <Spinner aria-hidden="true" />}
        {status === "pending" ? t("Grading…") : t("Send for grading")}
      </Button>
    </section>
  );
}

function usePromptLabel(rubric: EssayView["rubric"]): string {
  const t = useExtracted();

  const labels: Record<EssayView["rubric"], string> = {
    ap: t("Free response · AP scoring guidelines"),
    custom: t("Writing practice"),
    enem: t("Essay · ENEM rubric"),
    oab: t("Writing practice"),
  };

  return labels[rubric];
}

function Prompt() {
  const { essay } = useEssayScreen();
  const label = usePromptLabel(essay.rubric);

  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      {essay.context && <ItemText className="text-muted-foreground text-sm" text={essay.context} />}
      <h1 className="text-lg leading-snug font-semibold text-balance">
        <ItemLine text={essay.question} />
      </h1>
    </section>
  );
}

function EssayFooter() {
  const t = useExtracted();
  const { actions, drafts } = useEssayScreen();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (drafts.length === 0) {
    return null;
  }

  async function finish() {
    setPending(true);
    const finished = await actions.finish().catch(() => false);
    setPending(false);
    setFailed(!finished);
  }

  return (
    <>
      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("That didn't go through. Try again in a moment.")}
        </p>
      )}
      <TaskMainButton disabled={pending} onClick={() => void finish()}>
        {t("Continue")}
      </TaskMainButton>
    </>
  );
}

/**
 * Writing practice for an exam's essay, the same in both modes: the prompt, the learner's text,
 * and after grading, the estimated range by the official rubric with one next step. Rewriting
 * grades a new draft; Continue goes on with the session.
 */
export function EssayScreen({
  actions,
  essay,
  hrefs,
}: {
  actions: EssayActions;
  essay: EssayView;
  hrefs: EssayHrefs;
}) {
  const [drafts, setDrafts] = useState(essay.drafts);

  return (
    <EssayScreenProvider value={{ actions, drafts, essay, hrefs }}>
      <TaskFrame exitHref={hrefs.exit} footer={<EssayFooter />}>
        <Prompt />
        <EssayFeedback />
        <EssayWriter onGraded={(draft) => setDrafts((current) => [draft, ...current])} />
      </TaskFrame>
    </EssayScreenProvider>
  );
}
