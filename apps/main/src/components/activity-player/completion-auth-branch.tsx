"use client";

import { ClientLink } from "@/i18n/client-link";
import { useAuthState } from "@zoonk/core/auth/hooks/auth-state";
import { Badge } from "@zoonk/ui/components/badge";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { Brain, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { CountUp } from "./count-up";

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
  const isInline = variant === "inline";

  const backLink = (
    <ClientLink
      className={cn(
        buttonVariants({ variant: isInline ? "outline" : "default" }),
        isInline ? "flex-1 justify-between" : "w-full justify-between",
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
    </ClientLink>
  );

  const restartButton = (
    <Button
      className={cn(isInline ? "flex-1" : "w-full", "justify-between")}
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

        <SecondaryActions lessonHref={lessonHref} onRestart={onRestart} variant="inline" />
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

export function AuthBranch({
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
