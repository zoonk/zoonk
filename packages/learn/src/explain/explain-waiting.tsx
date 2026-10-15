"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleHelpIcon, GraduationCapIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { LearnLink } from "../learn-link";
import {
  OnboardingColumn,
  OnboardingFooter,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "../onboarding/onboarding-frame";
import { useQuickExplanationLabel } from "./quick-explanation-label";

/** The first screen usually shows within about 20 seconds; after this, offer to try again. */
const SLOW_MS = 45_000;
/** About five short screens: the outline's rows, each its own width, before titles are written. */
const PLACEHOLDER_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-1/3"];

/** The outline: numbered screens as flat rows (placeholders until written), then the one question. */
function Outline({ titles }: { titles: string[] }) {
  const t = useExtracted();

  const rows =
    titles.length > 0
      ? titles.map((title, index) => ({ id: `${index}:${title}`, number: index + 1, title }))
      : PLACEHOLDER_WIDTHS.map((width, index) => ({ id: width, number: index + 1, title: null }));

  return (
    <ol aria-label={t("What's coming")} className="flex flex-col text-sm [&>li+li]:border-t">
      {rows.map((row) => (
        <li className="flex min-h-11 items-center gap-3 py-2" key={row.id}>
          <span className="text-faint w-4 shrink-0 font-mono text-xs tabular-nums">
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

      <li className="text-muted-foreground flex min-h-11 items-center gap-3 py-2">
        <CircleHelpIcon aria-hidden="true" className="size-4 shrink-0" />
        {t("1 quick question at the end")}
      </li>
    </ol>
  );
}

/**
 * Where the learner can go instead, as a row of its own with what that builds: the subject's
 * course start page, which asks their level before anything is created, or onboarding with the
 * subject as the goal when there's no course.
 */
export function ExplainDeeperLink({ description, href }: { description: string; href: string }) {
  const t = useExtracted();

  return (
    <ListGroup>
      <ListRowLink href={href}>
        <ListRowLeading>
          <ListRowIcon>
            <GraduationCapIcon />
          </ListRowIcon>
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("I want to learn this in depth")}</ListRowTitle>
          <ListRowDescription>{description}</ListRowDescription>
        </ListRowContent>
      </ListRowLink>
    </ListGroup>
  );
}

/** A host that doesn't follow the run live shows the same wait, on its first step. */
const UNFOLLOWED_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

/**
 * Reads the page again until it shows the explanation, as other generation waits do: rarely while
 * the run is followed (an explanation another run wrote shows too), then soon once the run says it
 * can be read.
 */
function RefreshUntilShown({ isReady, onCheck }: { isReady: boolean; onCheck: () => void }) {
  useRefreshUntilShown({ isReady, refresh: onCheck });
  return null;
}

/** Whether the wait has gone on longer than the first screen usually takes. */
function useTakingLong(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  return waiting && slow;
}

/**
 * Before a quick explanation: the question, each step of writing it as it happens, and the
 * outline taking shape (about five screens and one question) until its titles are written. The
 * run's own progress is the wait: the host reads the page once it says the explanation can be read,
 * and the page reads itself again only as a fallback. Then "See explanation" starts it. A slow
 * start can be restarted, and a whole plan for the subject is one tap away (the host's `deeper`
 * control).
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
   * "I want to learn this in depth", the host's `ExplainDeeperLink`: to the subject's course start
   * page, or into onboarding when there's no course.
   */
  deeper: ReactNode;
  explanation: Pick<ExplanationView, "lesson" | "outline" | "title">;
  onCheck: () => void;
  onRetry: () => Promise<void>;
  onStart: () => void;
  /** The run writing it, when the host follows it live. */
  progress: GenerationRun | null;
}) {
  const t = useExtracted();
  const quickExplanation = useQuickExplanationLabel();
  const ready = Boolean(explanation.lesson);
  const isSlow = useTakingLong(!ready);

  return (
    <OnboardingFrame
      bar={{
        end: (
          <LearnLink
            aria-label={t("Close")}
            className={buttonVariants({ size: "icon-bar", variant: "ghost" })}
            href={closeHref}
          >
            <XIcon aria-hidden="true" className="size-5" />
          </LearnLink>
        ),
      }}
    >
      <OnboardingColumn>
        <OnboardingHeading>
          <OnboardingSubject>{quickExplanation}</OnboardingSubject>
          <OnboardingTitle>{explanation.title}</OnboardingTitle>
          <p className="text-muted-foreground text-sm">{t("No plan to set up.")}</p>
        </OnboardingHeading>

        {!ready && <GenerationWait kind="explanation" run={progress ?? UNFOLLOWED_RUN} />}
        {!ready && <RefreshUntilShown isReady={progress?.status === "ready"} onCheck={onCheck} />}

        <Outline titles={explanation.outline} />

        {deeper}

        {isSlow && !ready && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">
              {t("This is taking longer than usual.")}
            </p>
            <Button onClick={onRetry} size="sm" variant="outline">
              {t("Try again")}
            </Button>
          </div>
        )}

        {ready && (
          <OnboardingFooter>
            <OnboardingPrimaryButton autoFocus onClick={onStart}>
              {t("See explanation")}
            </OnboardingPrimaryButton>
          </OnboardingFooter>
        )}
      </OnboardingColumn>
    </OnboardingFrame>
  );
}
