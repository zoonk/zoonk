"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { CircleHelpIcon, GraduationCapIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
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

/** The first screen usually shows within about 20 s. */
const SLOW_MS = 45_000;
const PLACEHOLDER_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-1/3"];

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

const UNFOLLOWED_RUN: GenerationRun = { failure: null, status: "waiting", steps: {} };

function RefreshUntilShown({ isReady, onCheck }: { isReady: boolean; onCheck: () => void }) {
  useRefreshUntilShown({ isReady, refresh: onCheck });
  return null;
}

function SlowWait({ onRetry }: { onRetry: () => Promise<boolean> }) {
  const t = useExtracted();
  const isSlow = useTakingLong({ active: true, afterMs: SLOW_MS });
  const [isRetrying, startRetry] = useTransition();
  const [joined, setJoined] = useState(false);
  const lineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (joined && document.activeElement === document.body) {
      lineRef.current?.focus();
    }
  }, [joined]);

  if (!isSlow) {
    return null;
  }

  const retry = () => {
    startRetry(async () => {
      const { data } = await safeAsync(onRetry);
      setJoined(data === true);
    });
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <p
        className="text-muted-foreground text-sm outline-none"
        ref={lineRef}
        role="status"
        tabIndex={-1}
      >
        {joined || isRetrying
          ? t("Still writing your explanation. It shows up here as soon as it's ready.")
          : t("This is taking longer than usual.")}
      </p>

      {!joined && (
        <Button
          disabled={isRetrying}
          focusableWhenDisabled
          onClick={retry}
          size="sm"
          variant="outline"
        >
          {t("Try again")}
          {isRetrying && <Spinner aria-hidden="true" />}
        </Button>
      )}
    </div>
  );
}

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
  deeper: ReactNode;
  explanation: Pick<ExplanationView, "lesson" | "outline" | "title">;
  onCheck: () => void;
  onRetry: () => Promise<boolean>;
  onStart: () => void;
  progress: GenerationRun | null;
}) {
  const t = useExtracted();
  const quickExplanation = useQuickExplanationLabel();
  const ready = Boolean(explanation.lesson);
  const failed = progress?.status === "failed";

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

        {!ready && !failed && <SlowWait onRetry={onRetry} />}

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
