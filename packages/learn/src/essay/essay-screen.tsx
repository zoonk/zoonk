"use client";

import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { Callout } from "../_components/callout";
import { KindTile } from "../_components/kind-tile";
import { ItemLine, ItemText } from "../questions/item-text";
import { TaskFrame } from "../shell/task-frame";
import {
  type EssayActions,
  type EssayHrefs,
  EssayScreenProvider,
  useEssayScreen,
} from "./essay-context";
import { EssayGradeSteps, FinishEssayButton } from "./essay-feedback";
import { useCriterionName, useWritingName } from "./essay-labels";

export type { EssayActions } from "./essay-context";

type Status = "error" | "idle" | "limitReached" | "pending";

const WORD_PATTERN = /\S+/gu;

function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

/**
 * Grading an essay takes about 9 to 17 seconds (a fallback model takes up to 24 s): past `slowMs`
 * the screen says it's still grading, and past `timeoutMs` it stops waiting and lets the learner
 * send it again, with the text kept.
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

  // Grading takes ten to thirty seconds, so the learner knows it's working and roughly for how long.
  if (status === "pending") {
    return (
      <p className="text-muted-foreground text-center text-sm" role="status">
        {isSlow
          ? t("Still grading. This is taking longer than usual.")
          : t("Reading your essay against each criterion. It can take up to 30 seconds.")}
      </p>
    );
  }

  return null;
}

function EssayWriter({ onGraded }: { onGraded: (draft: EssayDraft) => void }) {
  const t = useExtracted();
  const textId = useId();
  const { actions, drafts, essay } = useEssayScreen();
  const writingName = useWritingName();
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
        {drafts.length > 0 ? t("Rewrite what needs work") : writingName(essay.rubric)}
      </label>
      <Textarea
        className="min-h-72 font-serif text-base leading-relaxed"
        id={textId}
        onChange={(event) => {
          startedAt.current ??= Date.now();
          setText(event.target.value);
        }}
        value={text}
      />
      {/* Counted from the first word: "0 words" under an empty box says nothing. */}
      <p className="text-muted-foreground min-h-4 text-xs tabular-nums" aria-live="polite">
        {words > 0 && t("{count, plural, one {# word} other {# words}}", { count: words })}
      </p>
      <StatusLine status={status} />
      <Button
        className={status === "pending" ? "disabled:opacity-100" : undefined}
        disabled={words === 0 || status === "pending" || essay.gradesLeft === 0}
        onClick={() => void send()}
        size="lg"
      >
        {status === "pending" && <Spinner aria-hidden="true" />}
        {status === "pending" && t("Grading…")}
        {status !== "pending" &&
          (drafts.length > 0 ? t("Grade the rewrite") : t("Send for grading"))}
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

  // The essay's tile and what it's graded by, then what it's about (the theme) on a soft panel the
  // eye finds first, and the task under it.
  return (
    <section className="flex flex-col gap-3">
      <p className="text-muted-foreground flex items-center gap-2.5 text-sm font-medium">
        <KindTile kind="essay" size="sm" />
        {label}
      </p>
      {essay.context && (
        <ItemText
          className="bg-muted/60 rounded-2xl p-4 leading-relaxed font-medium"
          text={essay.context}
        />
      )}
      <h1 className="text-lg leading-snug font-semibold text-balance">
        <ItemLine text={essay.question} />
      </h1>
    </section>
  );
}

/** While rewriting, the next step stays in view, and the whole grade one tap back. */
function RewriteGuide({ onSeeGrade }: { onSeeGrade: () => void }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const { drafts } = useEssayScreen();
  const grade = drafts[0]?.grade;

  if (!grade) {
    return null;
  }

  const criterion = grade.criteria.find((item) => item.id === grade.nextStep.criterionId);

  return (
    <Callout>
      <LightbulbIcon aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p>
          {criterion && (
            <span className="font-semibold">
              {t("Next step: {criterion}", { criterion: criterionName(criterion) })}{" "}
            </span>
          )}
          {grade.nextStep.text}
        </p>
        <button
          className="self-start font-medium underline underline-offset-4"
          onClick={onSeeGrade}
          type="button"
        >
          {t("See the grade")}
        </button>
      </div>
    </Callout>
  );
}

/** Once graded, going on without rewriting stays one quiet tap away. */
function EssayFooter() {
  const { drafts } = useEssayScreen();
  return drafts.length > 0 ? <FinishEssayButton variant="outline" /> : null;
}

/**
 * Writing practice for an exam's essay: the prompt and the learner's text, then the grade in steps
 * (the estimated range by the official rubric, the one next step, ENEM's proposal elements).
 * Rewriting is then the main action and grades a new draft, with the next step in view; Continue
 * goes on with the session.
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
  const [mode, setMode] = useState<"grade" | "write">(drafts.length > 0 ? "grade" : "write");
  const grade = drafts[0]?.grade;

  return (
    <EssayScreenProvider value={{ actions, drafts, essay, hrefs }}>
      {mode === "grade" && grade ? (
        <EssayGradeSteps grade={grade} onRewrite={() => setMode("write")} />
      ) : (
        <TaskFrame exitHref={hrefs.exit} footer={<EssayFooter />}>
          <Prompt />
          <RewriteGuide onSeeGrade={() => setMode("grade")} />
          <EssayWriter
            onGraded={(draft) => {
              setDrafts((current) => [draft, ...current]);
              setMode("grade");
            }}
          />
        </TaskFrame>
      )}
    </EssayScreenProvider>
  );
}
