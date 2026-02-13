"use client";

import { ContentFeedback } from "@/app/[locale]/(catalog)/learn/[prompt]/content-feedback";
import { ClientLink } from "@/i18n/client-link";
import { useAuthState } from "@zoonk/core/auth/hooks/auth-state";
import { computeScore } from "@zoonk/core/player/compute-score";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type StepResult } from "./player-reducer";

function CompletionScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-lg flex-col items-center gap-4 duration-200 ease-out motion-reduce:animate-none",
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

function CompletionActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="completion-actions"
      {...props}
    />
  );
}

function AuthenticatedContent({
  activityId,
  lessonHref,
  nextActivityHref,
}: {
  activityId: string;
  lessonHref: string;
  nextActivityHref: string | null;
}) {
  const t = useExtracted();

  return (
    <>
      <p className="text-muted-foreground text-sm">+10 BP</p>

      <CompletionActions>
        {nextActivityHref && (
          <ClientLink className={cn(buttonVariants(), "w-full")} href={nextActivityHref}>
            {t("Next Activity")}
          </ClientLink>
        )}

        <ClientLink
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href={lessonHref}
        >
          {t("Done")}
        </ClientLink>
      </CompletionActions>

      <ContentFeedback className="pt-8" contentId={activityId} kind="activity" variant="minimal" />
    </>
  );
}

function UnauthenticatedContent({ lessonHref }: { lessonHref: string }) {
  const t = useExtracted();

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <CompletionActions>
        <ClientLink className={cn(buttonVariants(), "w-full")} href="/login">
          {t("Login")}
        </ClientLink>

        <ClientLink
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href={lessonHref}
        >
          {t("Done")}
        </ClientLink>
      </CompletionActions>
    </>
  );
}

function PendingContent({ lessonHref }: { lessonHref: string }) {
  const t = useExtracted();

  return (
    <>
      <Skeleton className="h-4 w-32" />

      <CompletionActions>
        <ClientLink
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href={lessonHref}
        >
          {t("Done")}
        </ClientLink>
      </CompletionActions>
    </>
  );
}

function AuthBranch(props: {
  activityId: string;
  lessonHref: string;
  nextActivityHref: string | null;
}) {
  const authState = useAuthState();

  if (authState === "pending") {
    return <PendingContent lessonHref={props.lessonHref} />;
  }

  if (authState === "unauthenticated") {
    return <UnauthenticatedContent lessonHref={props.lessonHref} />;
  }

  return <AuthenticatedContent {...props} />;
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
  results,
}: {
  activityId: string;
  lessonHref: string;
  nextActivityHref: string | null;
  results: Record<string, StepResult>;
}) {
  const t = useExtracted();
  const score = getCompletionScore(results);

  return (
    <CompletionScreen>
      {score && (
        <CompletionScore>
          <p className="text-4xl font-bold tabular-nums">
            {score.correctCount}/{score.totalCount}
          </p>
          <p className="text-muted-foreground text-sm">{t("correct")}</p>
        </CompletionScore>
      )}

      <AuthBranch
        activityId={activityId}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
      />
    </CompletionScreen>
  );
}
