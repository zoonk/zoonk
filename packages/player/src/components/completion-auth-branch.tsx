"use client";

import { useAuthState } from "@zoonk/core/auth/hooks/auth-state";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type CompletionResult } from "../completion-input-schema";
import { usePlayer } from "../player-context";
import {
  BeltProgressHint,
  BeltProgressSkeleton,
  RewardBadges,
  RewardBadgesSkeleton,
} from "./reward-badges";

function CompletionActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="completion-actions"
      {...props}
    />
  );
}

function ActionRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full gap-3", className)} {...props} />;
}

function SecondaryActions({
  lessonHref,
  onRestart,
  variant,
}: {
  lessonHref: string;
  onRestart: () => void;
  variant: "inline" | "stacked";
}) {
  const t = useExtracted();
  const { LinkComponent } = usePlayer();
  const isInline = variant === "inline";

  const backLink = (
    <LinkComponent
      className={cn(
        buttonVariants({ variant: isInline ? "outline" : "default" }),
        isInline ? "flex-1 lg:justify-between" : "w-full lg:justify-between",
      )}
      href={lessonHref}
    >
      {t("Back to Lesson")}
      <Kbd
        className={cn(
          "hidden lg:inline-flex",
          isInline ? "opacity-60" : "bg-primary-foreground/15 text-primary-foreground opacity-70",
        )}
      >
        Esc
      </Kbd>
    </LinkComponent>
  );

  const restartButton = (
    <Button
      className={cn(isInline ? "flex-1" : "w-full", "lg:justify-between")}
      onClick={onRestart}
      variant="outline"
    >
      {t("Restart")}
      <Kbd className="hidden opacity-60 lg:inline-flex">R</Kbd>
    </Button>
  );

  if (isInline) {
    return (
      <ActionRow>
        {backLink}
        {restartButton}
      </ActionRow>
    );
  }

  return (
    <>
      {backLink}
      {restartButton}
    </>
  );
}

function AuthenticatedContent({
  completionResult,
  lessonHref,
  nextActivityHref,
  onRestart,
  showRewards,
}: {
  completionResult: CompletionResult | null;
  lessonHref: string;
  nextActivityHref: string | null;
  onRestart: () => void;
  showRewards: boolean;
}) {
  const t = useExtracted();
  const { LinkComponent } = usePlayer();
  const isLoading = !completionResult || completionResult.status !== "success";

  return (
    <>
      {showRewards &&
        (isLoading ? (
          <>
            <RewardBadgesSkeleton />
            <BeltProgressSkeleton />
          </>
        ) : (
          <>
            <RewardBadges
              brainPower={completionResult.brainPower}
              energyDelta={completionResult.energyDelta}
              isChallenge={false}
            />
            <BeltProgressHint
              brainPower={completionResult.brainPower}
              newTotalBp={completionResult.newTotalBp}
            />
          </>
        ))}

      <CompletionActions>
        {nextActivityHref ? (
          <>
            <LinkComponent
              className={cn(buttonVariants({ size: "lg" }), "w-full lg:justify-between")}
              href={nextActivityHref}
            >
              {t("Next")}
              <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
                Enter
              </Kbd>
            </LinkComponent>

            <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="inline" />
          </>
        ) : (
          <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="stacked" />
        )}
      </CompletionActions>
    </>
  );
}

function UnauthenticatedContent({
  lessonHref,
  loginHref,
  onRestart,
}: {
  lessonHref: string;
  loginHref: string;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const { LinkComponent } = usePlayer();

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <CompletionActions>
        <LinkComponent className={cn(buttonVariants(), "w-full")} href={loginHref}>
          {t("Login")}
        </LinkComponent>

        <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="inline" />
      </CompletionActions>
    </>
  );
}

function PendingContent({ lessonHref }: { lessonHref: string }) {
  const t = useExtracted();
  const { LinkComponent } = usePlayer();

  return (
    <>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>

      <CompletionActions>
        <LinkComponent
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href={lessonHref}
        >
          {t("Back to Lesson")}
        </LinkComponent>
      </CompletionActions>
    </>
  );
}

export function AuthBranch({
  completionResult,
  lessonHref,
  nextActivityHref,
  onRestart,
  showRewards = true,
}: {
  completionResult: CompletionResult | null;
  lessonHref: string;
  nextActivityHref: string | null;
  onRestart: () => void;
  showRewards?: boolean;
}) {
  const authState = useAuthState();
  const { loginHref } = usePlayer();

  if (authState === "pending") {
    return <PendingContent lessonHref={lessonHref} />;
  }

  if (authState === "unauthenticated") {
    return (
      <UnauthenticatedContent
        lessonHref={lessonHref}
        loginHref={loginHref ?? "/login"}
        onRestart={onRestart}
      />
    );
  }

  return (
    <AuthenticatedContent
      completionResult={completionResult}
      lessonHref={lessonHref}
      nextActivityHref={nextActivityHref}
      onRestart={onRestart}
      showRewards={showRewards}
    />
  );
}
