"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import {
  ChevronRightIcon,
  CircleHelpIcon,
  GraduationCapIcon,
  LightbulbIcon,
  XIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { usePoll } from "../_utils/use-poll";
import { LearnLink } from "../learn-link";
import { type GenerationProgress, GenerationSteps } from "../onboarding/generation-progress";
import {
  OnboardingColumn,
  OnboardingFrame,
  OnboardingPrimaryButton,
  OnboardingTitle,
  OnboardingTopBar,
} from "../onboarding/onboarding-frame";

/** A fallback: the host shows the explanation as soon as its run says it can be read. */
const POLL_MS = 5000;
/** The first screen usually shows within about 20 seconds; after this, offer to try again. */
const SLOW_MS = 45_000;
/** About five short screens: the outline's rows, each its own width, before titles are written. */
const PLACEHOLDER_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-1/3"];

/** The outline: numbered screens (placeholders until written), then the one question. */
function Outline({ titles }: { titles: string[] }) {
  const t = useExtracted();

  const rows =
    titles.length > 0
      ? titles.map((title, index) => ({ id: `${index}:${title}`, number: index + 1, title }))
      : PLACEHOLDER_WIDTHS.map((width, index) => ({ id: width, number: index + 1, title: null }));

  return (
    <ol aria-label={t("What's coming")} className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li className="flex items-center gap-3" key={row.id}>
          <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
            {row.number}
          </span>
          {row.title ?? (
            <Skeleton
              aria-hidden="true"
              className={cn("h-3.5", PLACEHOLDER_WIDTHS[row.number - 1])}
            />
          )}
        </li>
      ))}

      <li className="text-muted-foreground flex items-center gap-3">
        <CircleHelpIcon aria-hidden="true" className="size-6 shrink-0 p-0.5" />
        {t("1 quick question at the end")}
      </li>
    </ol>
  );
}

const DEEPER_ROW_CLASS =
  "bg-card ring-foreground/10 hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-16 w-full items-center gap-3 rounded-3xl px-4 py-3 text-left ring-1 outline-none focus-visible:ring-[3px] disabled:pointer-events-none";

/** "I want to learn this in depth" and what that builds, with where the row leads at its end. */
function DeeperRowContent({
  description,
  pending = false,
}: {
  description: string;
  pending?: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
        <GraduationCapIcon aria-hidden="true" className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{t("I want to learn this in depth")}</span>
        <span className="text-muted-foreground text-sm">{description}</span>
      </span>
      {pending ? (
        <Spinner className="text-muted-foreground size-4 shrink-0" />
      ) : (
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      )}
    </>
  );
}

/** Where the learner can go instead: onboarding with the subject as the goal. */
export function ExplainDeeperLink({ description, href }: { description: string; href: string }) {
  return (
    <LearnLink className={DEEPER_ROW_CLASS} href={href}>
      <DeeperRowContent description={description} />
    </LearnLink>
  );
}

/**
 * Where the learner can go instead, in one tap: the host starts a plan from the subject's course
 * and goes on to what onboarding still asks. Pending shows in the row while it starts.
 */
export function ExplainDeeperButton({
  description,
  onClick,
  pending,
}: {
  description: string;
  onClick: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      <button className={DEEPER_ROW_CLASS} disabled={pending} onClick={onClick} type="button">
        <DeeperRowContent description={description} pending={pending} />
      </button>

      {pending && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}
    </>
  );
}

function WritingStatus({ progress }: { progress: GenerationProgress | null }) {
  const t = useExtracted();

  if (progress && progress.status !== "waiting") {
    return <GenerationSteps kind="explanation" progress={progress} />;
  }

  return (
    <div aria-live="polite" className="flex items-center gap-3" role="status">
      <Spinner className="size-5" />
      <span className="font-medium">{t("Writing your explanation…")}</span>
    </div>
  );
}

/**
 * Before a quick explanation: the question, each step of writing it as it happens, and the
 * outline taking shape (about five screens and one question) until its titles are written. The
 * page asks again until it's ready; then "See explanation" starts it. A slow start can be
 * restarted, and a whole plan for the subject is one tap away (the host's `deeper` control).
 */
export function ExplainWaiting({
  closeHref,
  deeper,
  explanation,
  onCheck,
  onRetry,
  onStart,
  progress,
}: {
  closeHref: string;
  /**
   * "I want to learn this in depth", the host's control: `ExplainDeeperButton` to start the
   * subject's course, or `ExplainDeeperLink` into onboarding when there's no course.
   */
  deeper: ReactNode;
  explanation: Pick<ExplanationView, "lesson" | "outline" | "title">;
  onCheck: () => void;
  onRetry: () => Promise<void>;
  onStart: () => void;
  /** The run writing it, when the host follows it live. */
  progress: GenerationProgress | null;
}) {
  const t = useExtracted();
  const startedAt = useRef(0);
  const [isSlow, setIsSlow] = useState(false);
  const ready = Boolean(explanation.lesson);

  usePoll({
    active: !ready,
    intervalMs: POLL_MS,
    onPoll: () => {
      startedAt.current ||= Date.now();
      setIsSlow(Date.now() - startedAt.current > SLOW_MS);
      onCheck();
    },
  });

  return (
    <OnboardingFrame>
      <OnboardingTopBar
        end={
          <LearnLink
            aria-label={t("Close")}
            className="hover:bg-muted focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
            href={closeHref}
          >
            <XIcon aria-hidden="true" className="size-5" />
          </LearnLink>
        }
      />

      <OnboardingColumn>
        <div className="bg-card ring-foreground/10 flex flex-col gap-5 rounded-3xl p-5 ring-1 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
              <LightbulbIcon
                aria-hidden="true"
                className="size-5 text-amber-700 dark:text-amber-400"
              />
            </span>
            <span className="flex flex-col">
              <span className="text-muted-foreground text-xs">
                {t("Quick explanation · 5 min")}
              </span>
              <OnboardingTitle className="text-xl sm:text-2xl">{explanation.title}</OnboardingTitle>
            </span>
          </div>

          {!ready && <WritingStatus progress={progress} />}

          <Outline titles={explanation.outline} />

          <p className="text-muted-foreground text-sm">{t("No plan to set up.")}</p>

          {ready && (
            <OnboardingPrimaryButton autoFocus onClick={onStart}>
              {t("See explanation")}
            </OnboardingPrimaryButton>
          )}
        </div>

        {deeper}

        {isSlow && !ready && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">
              {t("This is taking longer than usual.")}
            </p>
            <Button onClick={onRetry} variant="outline">
              {t("Try again")}
            </Button>
          </div>
        )}
      </OnboardingColumn>
    </OnboardingFrame>
  );
}
