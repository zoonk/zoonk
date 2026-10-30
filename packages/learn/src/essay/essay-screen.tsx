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
import { AnswersSaveError } from "../_components/save-error";
import { TaskHeaderTitle } from "../_components/task-header";
import { TASK_MAIN_ACTION_CLASS, TaskActions } from "../_components/task-layout";
import { isLongText } from "../questions/long-text";
import { TaskFrame } from "../shell/task-frame";
import {
  type EssayActions,
  type EssayHrefs,
  EssayScreenProvider,
  useEssayScreen,
} from "./essay-context";
import { EssayGradeSteps } from "./essay-feedback";
import { useWritingName } from "./essay-labels";
import { EssayInstruction, EssayTexts, usePromptLabel, useTextsLabel } from "./essay-prompt";
import { RewriteGuide } from "./essay-rewrite-guide";
import { clearUnsentText, keepUnsentText, readUnsentText } from "./unsent-text";
import { useFinishEssay } from "./use-finish-essay";

export type { EssayActions } from "./essay-context";

type Status = "error" | "idle" | "limitReached" | "pending";

const WORD_PATTERN = /\S+/gu;

function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

/** Grading takes about 9 to 17 s, and up to 24 s on the fallback model. */
const GRADING_BOUNDS = { slowMs: 20_000, timeoutMs: 90_000 } as const;

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

function subscribeToStorage(onChange: () => void) {
  globalThis.addEventListener("storage", onChange);
  return () => globalThis.removeEventListener("storage", onChange);
}

function useKeptText(blockId: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => readUnsentText(blockId),
    () => null,
  );
}

function useEssayWriter(onGraded: (draft: EssayDraft) => void) {
  const { actions, drafts, essay } = useEssayScreen();
  const graded = drafts[0]?.text ?? "";
  const [typed, setTyped] = useState<string | null>(null);
  const kept = useKeptText(essay.blockId);
  const text = typed ?? (kept?.trim() && kept !== graded ? kept : graded);
  const [status, setStatus] = useState<Status>("idle");
  const startedAt = useRef<number | null>(null);
  const ungraded = useRef<{ attemptId: string; text: string } | null>(null);
  const words = countWords(text);
  const gradesLeft = Math.max(0, essay.gradesLeft - (drafts.length - essay.drafts.length));

  async function send() {
    setStatus("pending");

    const durationMs = startedAt.current === null ? 0 : Date.now() - startedAt.current;

    const attemptId =
      ungraded.current?.text === text ? ungraded.current.attemptId : crypto.randomUUID();

    ungraded.current = { attemptId, text };

    const settled = await settleWithin({
      ms: GRADING_BOUNDS.timeoutMs,
      request: () => actions.submit({ attemptId, durationMs, text }),
    }).catch(() => null);

    const result = settled?.status === "settled" ? settled.value : null;

    if (result === "limitReached" || result === null) {
      setStatus(result === null ? "error" : "limitReached");
      return;
    }

    setStatus("idle");
    startedAt.current = null;
    ungraded.current = null;
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
        className="min-h-72 flex-1 text-base leading-relaxed md:text-base lg:field-sizing-fixed lg:min-h-36"
        id={textId}
        onChange={(event) => writer.write(event.target.value)}
        value={writer.text}
      />
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

function EssayWriteFooter({ writer }: { writer: EssayWriter }) {
  const t = useExtracted();
  const { drafts } = useEssayScreen();
  const finishing = useFinishEssay();
  const pending = writer.status === "pending";

  return (
    <>
      <StatusLine gradesLeft={writer.gradesLeft} status={writer.status} />
      {finishing.failed && !finishing.pending && (
        <AnswersSaveError onRetry={() => void finishing.finish()} />
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
          disabled={!writer.canSend || finishing.pending}
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

function EssayWriteScreen({
  onGraded,
  onSeeGrade,
}: {
  onGraded: (draft: EssayDraft) => void;
  onSeeGrade: () => void;
}) {
  const t = useExtracted();
  const { drafts, essay, hrefs } = useEssayScreen();
  const label = usePromptLabel(essay.rubric);
  const textsLabel = useTextsLabel(essay.rubric);
  const writer = useEssayWriter(onGraded);
  const lastGrade = drafts[0]?.grade;
  const criteria = Boolean(lastGrade) && lastGrade?.zeroReason !== "tooShort";
  const texts = isLongText(essay.context) ? essay.context : null;

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
      aside={
        texts || criteria
          ? {
              label: texts
                ? textsLabel
                : t({
                    description: "The grade of the learner's last essay draft.",
                    message: "Your last grade",
                  }),
              title: texts ? textsLabel : undefined,
            }
          : null
      }
      confirmExit={confirmExit}
      exitHref={hrefs.exit}
      fit
      footer={<EssayWriteFooter writer={writer} />}
      headerTitle={<TaskHeaderTitle title={label} />}
    >
      <EssayTexts criteria={criteria} texts={texts} />
      <EssayInstruction context={texts ? null : essay.context} />
      <RewriteGuide onSeeGrade={onSeeGrade} />
      <EssayBox writer={writer} />
    </TaskFrame>
  );
}

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
