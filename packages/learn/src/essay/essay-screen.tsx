"use client";

import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { cn } from "@zoonk/ui/lib/utils";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { TASK_MAIN_ACTION_CLASS, TaskActions, TaskAsideContent } from "../_components/task-layout";
import { ItemStem, ItemText, QUESTION_TEXT_CLASS } from "../questions/item-text";
import { TaskFrame } from "../shell/task-frame";
import {
  type EssayActions,
  type EssayHrefs,
  EssayScreenProvider,
  useEssayScreen,
} from "./essay-context";
import { EssayGradeSteps } from "./essay-feedback";
import { useWritingName } from "./essay-labels";
import { CriteriaInView, RewriteGuide } from "./essay-rewrite-guide";
import { clearUnsentText, keepUnsentText, readUnsentText } from "./unsent-text";
import { useFinishEssay } from "./use-finish-essay";

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

/**
 * The bar's quiet line about sending: why it didn't go through, why Send waits (today's grades are
 * used: before a send is refused too), or that it's grading and roughly for how long.
 */
function StatusLine({ gradesLeft, status }: { gradesLeft: number; status: Status }) {
  const t = useExtracted();
  const isSlow = useTakingLong({ active: status === "pending", afterMs: GRADING_BOUNDS.slowMs });

  if (status === "error") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("That didn't go through. Your text is still here. Try again in a moment.")}
      </p>
    );
  }

  if (status === "limitReached" || gradesLeft === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("You've used today's essay grades. Your text stays here; send it tomorrow.")}
      </p>
    );
  }

  // Grading takes ten to thirty seconds, so the learner knows it's working and roughly for how long.
  if (status === "pending") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {isSlow
          ? t("Still grading. This is taking longer than usual.")
          : t("Reading your essay against each criterion. It can take up to 30 seconds.")}
      </p>
    );
  }

  return null;
}

/** Another tab writing the same essay keeps its text too: until this one types, it shows here. */
function subscribeToStorage(onChange: () => void) {
  globalThis.addEventListener("storage", onChange);
  return () => globalThis.removeEventListener("storage", onChange);
}

/**
 * The text typed on this device and not graded yet, read once the page is in the browser: the
 * server never has it, so the page first draws the last graded text, as the server did.
 */
function useKeptText(blockId: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => readUnsentText(blockId),
    () => null,
  );
}

/**
 * The learner's text and sending it for grading: the text is kept on screen whatever happens, and
 * on the device as it's typed until it's graded (opening the essay again brings it back), writing
 * time runs from the first keystroke, and a grade that fails or takes too long lets the learner
 * send it again. `unsent` is text that leaving would leave behind; `gradesLeft` counts the grades
 * this visit used, so Send says it's waiting for tomorrow before a send is refused.
 */
function useEssayWriter(onGraded: (draft: EssayDraft) => void) {
  const { actions, drafts, essay } = useEssayScreen();
  const graded = drafts[0]?.text ?? "";
  // What the learner typed since the screen opened; until then, the text kept on this device.
  const [typed, setTyped] = useState<string | null>(null);
  const kept = useKeptText(essay.blockId);
  const text = typed ?? (kept?.trim() && kept !== graded ? kept : graded);
  const [status, setStatus] = useState<Status>("idle");
  // Writing time runs from the first keystroke, not from when the screen opened.
  const startedAt = useRef<number | null>(null);
  const words = countWords(text);
  const gradesLeft = Math.max(0, essay.gradesLeft - (drafts.length - essay.drafts.length));

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
    clearUnsentText(essay.blockId);
    onGraded(result);
  }

  function write(next: string) {
    startedAt.current ??= Date.now();
    setTyped(next);
    keepUnsentText({ blockId: essay.blockId, text: next });
  }

  const canSend = words > 0 && status !== "pending" && gradesLeft > 0;
  const unsent = text.trim().length > 0 && text !== graded;

  return { canSend, gradesLeft, send, status, text, unsent, words, write };
}

type EssayWriter = ReturnType<typeof useEssayWriter>;

/**
 * The box to write in, in a book's face at 16px on every screen, filling the column down to the
 * action bar, with its word count in the mono face.
 */
function EssayBox({ writer }: { writer: EssayWriter }) {
  const t = useExtracted();
  const textId = useId();
  const { drafts, essay } = useEssayScreen();
  const writingName = useWritingName();

  return (
    <section className="flex flex-1 flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={textId}>
        {drafts.length > 0 ? t("Rewrite what needs work") : writingName(essay.rubric)}
      </label>
      <Textarea
        className="min-h-72 flex-1 font-serif text-base leading-relaxed md:text-base"
        id={textId}
        onChange={(event) => writer.write(event.target.value)}
        value={writer.text}
      />
      {/* Counted from the first word: "0 words" under an empty box says nothing. */}
      <p
        aria-live="polite"
        className="text-muted-foreground min-h-4 font-mono text-xs tabular-nums"
      >
        {writer.words > 0 &&
          t("{count, plural, one {# word} other {# words}}", { count: writer.words })}
      </p>
    </section>
  );
}

/**
 * The writing screen's pinned action bar: sending the text for grading, and once a draft is
 * graded, skipping the rewrite beside it (going on with the session).
 */
function EssayWriteFooter({ writer }: { writer: EssayWriter }) {
  const t = useExtracted();
  const { drafts } = useEssayScreen();
  const finishing = useFinishEssay();
  const pending = writer.status === "pending";

  return (
    <>
      <StatusLine gradesLeft={writer.gradesLeft} status={writer.status} />
      {finishing.failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("That didn't go through. Try again in a moment.")}
        </p>
      )}
      <TaskActions>
        {drafts.length > 0 && (
          <Button
            className="shrink-0"
            disabled={finishing.pending}
            onClick={() => void finishing.finish()}
            size="xl"
            variant="outline"
          >
            {t("Skip the rewrite")}
          </Button>
        )}
        <Button
          className={cn(TASK_MAIN_ACTION_CLASS, pending && "disabled:opacity-100")}
          disabled={!writer.canSend}
          onClick={() => void writer.send()}
          size="xl"
        >
          {pending && <Spinner aria-hidden="true" />}
          {pending && t("Grading…")}
          {!pending && (drafts.length > 0 ? t("Grade the rewrite") : t("Send for grading"))}
        </Button>
      </TaskActions>
    </>
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

/**
 * What it's graded by as the label above (the aside's own label from `lg`), then what it's about
 * (the theme, its motivating texts) as a quote, flat on the page, and the task under it in the
 * question face.
 */
function Prompt() {
  const { essay } = useEssayScreen();
  const label = usePromptLabel(essay.rubric);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-label lg:hidden">{label}</p>
      {essay.context && (
        <ItemText
          className="border-border border-l-2 pl-4 text-sm leading-relaxed lg:group-data-aside/task:border-l-0 lg:group-data-aside/task:pl-0"
          text={essay.context}
        />
      )}
      <div className={QUESTION_TEXT_CLASS}>
        <ItemStem text={essay.question} heading="h1" />
      </div>
    </section>
  );
}

/**
 * Writing (or rewriting) the essay: the prompt, the next step in view while rewriting, the box,
 * and Send in the pinned action bar. On a phone the prompt sits above the box; from `lg` it moves
 * beside it, into the aside, with the last grade's criteria, and the box fills the column.
 */
function EssayWriteScreen({
  onGraded,
  onSeeGrade,
}: {
  onGraded: (draft: EssayDraft) => void;
  onSeeGrade: () => void;
}) {
  const t = useExtracted();
  const { essay, hrefs } = useEssayScreen();
  const label = usePromptLabel(essay.rubric);
  const writer = useEssayWriter(onGraded);

  // Unsent text stays on the device, so leaving loses nothing, but the learner hears it first.
  const confirmExit = writer.unsent
    ? {
        cancel: t("Keep writing"),
        confirm: t("Leave"),
        description: t("Your text stays on this device, here when you come back."),
        title: t("Leave for now?"),
      }
    : null;

  return (
    <TaskFrame
      aside={{ label, title: label }}
      confirmExit={confirmExit}
      exitHref={hrefs.exit}
      footer={<EssayWriteFooter writer={writer} />}
    >
      <TaskAsideContent className="flex flex-col gap-6">
        <Prompt />
        <CriteriaInView />
        <RewriteGuide onSeeGrade={onSeeGrade} />
      </TaskAsideContent>
      <EssayBox writer={writer} />
    </TaskFrame>
  );
}

/**
 * Writing practice for an exam's essay: the prompt and the learner's text, then the grade in steps
 * (the estimated range by the official rubric, then the one next step, with ENEM's proposal
 * elements). Rewriting is then the main action and grades a new draft, with the next step in view;
 * skipping the rewrite goes on with the session.
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
        <EssayWriteScreen
          onGraded={(draft) => {
            setDrafts((current) => [draft, ...current]);
            setMode("grade");
          }}
          onSeeGrade={() => setMode("grade")}
        />
      )}
    </EssayScreenProvider>
  );
}
