"use client";

import { Button } from "@zoonk/ui/components/button";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterKey, useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, FlagIcon, LockIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { formatClock } from "../_utils/clock";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { MockAnswerSheet, useSectionCounts } from "./mock-answer-sheet";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { useSectionName } from "./mock-labels";
import { MockQuestionCard } from "./mock-question";

const TICK_MS = 1000;
const PERCENT = 100;

/** The section's clock, ticking every second. When it reaches zero, the section is handed in. */
function useSectionClock(deadline: string) {
  const { runner } = useMockScreen();
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, new Date(deadline).getTime() - now);
  const handedIn = useRef<string | null>(null);
  const handIn = useEffectEvent(() => void runner.submitSection());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Once per section: a failed hand-in shows its error instead of retrying every second.
  useEffect(() => {
    if (remaining === 0 && handedIn.current !== deadline) {
      handedIn.current = deadline;
      handIn();
    }
  }, [deadline, remaining]);

  return remaining;
}

function ClockTitle({ deadline }: { deadline: string }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const remaining = useSectionClock(deadline);
  const sectionName = useSectionName();
  const section = runner.view.sections.find((item) => item.status === "current");

  return (
    <div className="flex flex-col items-center leading-tight">
      {/* Exam days have long names ("Linguagens, Ciências Humanas e redação"): they wrap, never cut. */}
      <span className="text-muted-foreground text-xs text-balance whitespace-normal">
        {sectionName(section?.name ?? null)}
      </span>
      {/* The server renders the clock a moment before the browser takes over. */}
      <span
        aria-label={t("Time left")}
        className="text-foreground in-data-[mode=fun]:font-fun-display text-xl font-semibold tabular-nums"
        role="timer"
        suppressHydrationWarning
      >
        {formatClock(remaining)}
      </span>
    </div>
  );
}

function FlagButton() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const question = runner.view.current?.questions[runner.position];
  const flagged = Boolean(question && runner.drafts[question.itemId]?.flagged);

  return (
    <Button
      aria-pressed={flagged}
      className={cn("in-data-[mode=fun]:fun-glass", flagged && "text-warning")}
      onClick={runner.toggleFlag}
      size="lg"
      variant="outline"
    >
      <FlagIcon aria-hidden="true" className={cn(flagged && "fill-current")} />
      {t("Flag")}
    </Button>
  );
}

function NextLabel({ isLast, label }: { isLast: boolean; label: string }) {
  const t = useExtracted();

  if (isLast) {
    return label;
  }

  return (
    <>
      {t("Next")}
      <ChevronRightIcon aria-hidden="true" />
    </>
  );
}

function RunnerFooter() {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const { runner } = useMockScreen();
  const total = runner.view.current?.questions.length ?? 0;
  const isLastQuestion = runner.position >= total - 1;
  const isLastSection = runner.view.sections.at(-1)?.status === "current";

  function next() {
    if (isLastQuestion) {
      void runner.submitSection();
      return;
    }

    runner.go(runner.position + 1);
  }

  const screenKey = { mode: "none", screen: true } as const;

  // Enter moves on after a number key picked an answer; handing in stays a deliberate click.
  useEnterKey(() => runner.go(runner.position + 1), {
    enabled: !isLastQuestion && !runner.pending,
  });

  useKeyboardCallback("ArrowRight", () => runner.go(runner.position + 1), screenKey);
  useKeyboardCallback("ArrowLeft", () => runner.go(runner.position - 1), screenKey);

  const nextLabel = isLastSection ? t("Hand in the mock exam") : t("Hand in this section");
  // Also when the clock hands the section in, wherever the learner is.
  const handingIn = runner.busy === "submit";

  return (
    <>
      <MockStepStatus />
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <LockIcon aria-hidden="true" className="size-3.5" />
        {t("No feedback until the end, just like on exam day.")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          aria-label={t("Previous")}
          className="in-data-[mode=fun]:fun-glass w-14 shrink-0 px-0"
          disabled={runner.position === 0 || runner.pending}
          onClick={() => runner.go(runner.position - 1)}
          size="xl"
          variant="outline"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          className={cn("flex-1", handingIn && "disabled:opacity-100")}
          disabled={runner.pending}
          onClick={next}
          size="xl"
          variant={primaryVariant}
        >
          {handingIn && <Spinner aria-hidden="true" />}
          {handingIn ? t("Handing in…") : <NextLabel isLast={isLastQuestion} label={nextLabel} />}
        </Button>
        <MockAnswerSheet />
      </div>
    </>
  );
}

/**
 * The running section, like the exam room: the clock, one question at a time with no feedback,
 * a flag to come back to it, the answer sheet to jump around and hand the section in.
 */
export function MockRunnerView() {
  const t = useExtracted();
  const locale = useLocale();
  const { runner } = useMockScreen();
  const { current } = runner.view;
  const counts = useSectionCounts();
  const question = current?.questions[runner.position];

  if (!current || !question) {
    return null;
  }

  return (
    <MockFrame
      footer={<RunnerFooter />}
      headerEnd={<FlagButton />}
      headerTitle={<ClockTitle deadline={current.deadline} />}
    >
      <ProgressRoot
        locale={locale}
        aria-label={t("Questions answered in this section")}
        value={counts.total > 0 ? (counts.answered / counts.total) * PERCENT : 0}
      >
        <ProgressTrack className="h-1">
          <ProgressIndicator className="in-data-[mode=fun]:bg-fun-accent-lime" />
        </ProgressTrack>
      </ProgressRoot>

      <MockQuestionCard key={question.itemId} question={question} />
    </MockFrame>
  );
}
