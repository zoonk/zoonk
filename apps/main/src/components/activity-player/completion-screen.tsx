"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { ClientLink } from "@/i18n/client-link";
import { useAuthState } from "@zoonk/core/auth/hooks/auth-state";
import { computeScore } from "@zoonk/core/player/compute-score";
import { Badge } from "@zoonk/ui/components/badge";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { Brain, CircleCheck, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { CountUp } from "./count-up";
import { type StepResult } from "./player-reducer";

function CompletionScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in mx-auto flex w-full max-w-lg flex-col items-center gap-6 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
      data-slot="completion-screen"
      role="status"
      {...props}
    />
  );
}

function CompletionScore({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col items-center gap-1", className)}
      data-slot="completion-score"
      {...props}
    />
  );
}

function CompletionSignal() {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-center gap-2">
      <CircleCheck className="text-foreground size-12" />
      <p className="text-lg font-medium">{t("Completed")}</p>
    </div>
  );
}

function CompletionActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="completion-actions"
      {...props}
    />
  );
}

function RewardBadges() {
  const t = useExtracted();

  return (
    <div className="flex gap-2">
      <Badge variant="secondary">
        <Brain data-icon="inline-start" />
        <span>
          +<CountUp value={10} />
        </span>{" "}
        {t("BP")}
      </Badge>

      <Badge variant="secondary">
        <ZapIcon className="text-energy" data-icon="inline-start" />
        <span>
          +<CountUp value={5} />
        </span>
        <span className="sr-only">{t("Energy")}</span>
      </Badge>
    </div>
  );
}

function ActionRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full gap-3", className)} {...props} />;
}

function AuthenticatedContent({
  lessonHref,
  nextActivityHref,
  onRestart,
}: {
  lessonHref: string;
  nextActivityHref: string | null;
  onRestart: () => void;
}) {
  const t = useExtracted();

  return (
    <>
      <RewardBadges />

      <CompletionActions>
        {nextActivityHref ? (
          <>
            <ClientLink
              className={cn(buttonVariants({ size: "lg" }), "w-full justify-between")}
              href={nextActivityHref}
            >
              {t("Next")}
              <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
                Enter
              </Kbd>
            </ClientLink>

            <ActionRow>
              <ClientLink
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-between")}
                href={lessonHref}
              >
                {t("Back to Lesson")}
                <Kbd className="hidden opacity-60 lg:inline-flex">Esc</Kbd>
              </ClientLink>

              <button
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-between")}
                onClick={onRestart}
                type="button"
              >
                {t("Restart")}
                <Kbd className="hidden opacity-60 lg:inline-flex">R</Kbd>
              </button>
            </ActionRow>
          </>
        ) : (
          <>
            <ClientLink
              className={cn(buttonVariants(), "w-full justify-between")}
              href={lessonHref}
            >
              {t("Back to Lesson")}
              <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
                Esc
              </Kbd>
            </ClientLink>

            <button
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
              onClick={onRestart}
              type="button"
            >
              {t("Restart")}
              <Kbd className="hidden opacity-60 lg:inline-flex">R</Kbd>
            </button>
          </>
        )}
      </CompletionActions>
    </>
  );
}

function UnauthenticatedContent({
  lessonHref,
  onRestart,
}: {
  lessonHref: string;
  onRestart: () => void;
}) {
  const t = useExtracted();

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <CompletionActions>
        <ClientLink className={cn(buttonVariants(), "w-full")} href="/login">
          {t("Login")}
        </ClientLink>

        <ActionRow>
          <ClientLink
            className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-between")}
            href={lessonHref}
          >
            {t("Back to Lesson")}
            <Kbd className="hidden opacity-60 lg:inline-flex">Esc</Kbd>
          </ClientLink>

          <button
            className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-between")}
            onClick={onRestart}
            type="button"
          >
            {t("Restart")}
            <Kbd className="hidden opacity-60 lg:inline-flex">R</Kbd>
          </button>
        </ActionRow>
      </CompletionActions>
    </>
  );
}

function PendingContent({ lessonHref }: { lessonHref: string }) {
  const t = useExtracted();

  return (
    <>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>

      <CompletionActions>
        <ClientLink
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href={lessonHref}
        >
          {t("Back to Lesson")}
        </ClientLink>
      </CompletionActions>
    </>
  );
}

function AuthBranch({
  lessonHref,
  nextActivityHref,
  onRestart,
}: {
  lessonHref: string;
  nextActivityHref: string | null;
  onRestart: () => void;
}) {
  const authState = useAuthState();

  if (authState === "pending") {
    return <PendingContent lessonHref={lessonHref} />;
  }

  if (authState === "unauthenticated") {
    return <UnauthenticatedContent lessonHref={lessonHref} onRestart={onRestart} />;
  }

  return (
    <AuthenticatedContent
      lessonHref={lessonHref}
      nextActivityHref={nextActivityHref}
      onRestart={onRestart}
    />
  );
}

export function getCompletionScore(results: Record<string, StepResult>) {
  const resultList = Object.values(results);

  if (resultList.length === 0) {
    return null;
  }

  const score = computeScore({
    results: resultList.map((stepResult) => ({ isCorrect: stepResult.result.isCorrect })),
  });

  return { correctCount: score.correctCount, totalCount: resultList.length };
}

export function CompletionScreenContent({
  activityId,
  lessonHref,
  nextActivityHref,
  onRestart,
  results,
}: {
  activityId: string;
  lessonHref: string;
  nextActivityHref: string | null;
  onRestart: () => void;
  results: Record<string, StepResult>;
}) {
  const t = useExtracted();
  const score = getCompletionScore(results);

  return (
    <CompletionScreen>
      {score ? (
        <CompletionScore>
          <p className="text-5xl font-bold tracking-tight tabular-nums">
            {score.correctCount}/{score.totalCount}
          </p>
          <p className="text-muted-foreground text-sm">{t("correct")}</p>
        </CompletionScore>
      ) : (
        <CompletionSignal />
      )}

      <AuthBranch
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
      />

      <ContentFeedback className="pt-8" contentId={activityId} kind="activity" variant="minimal" />
    </CompletionScreen>
  );
}
