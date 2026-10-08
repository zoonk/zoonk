"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, createContext, use } from "react";
import { toLabelCase } from "../_utils/label-case";

const OnboardingChromeContext = createContext<ReactNode>(null);

/** Where the learner is in the goal's questions, for the screen's eyebrow ("ENEM · Step 2 of 4"). */
type OnboardingProgress = { current: number; total: number };

const OnboardingProgressContext = createContext<OnboardingProgress | null>(null);

/** The question the learner is on, from the steps' flow, so each screen's eyebrow can say it. */
export function OnboardingProgressProvider({
  children,
  progress,
}: {
  children: ReactNode;
  progress: OnboardingProgress | null;
}) {
  return <OnboardingProgressContext value={progress}>{children}</OnboardingProgressContext>;
}

/**
 * The app's own top bar for every onboarding page, from the host's layout: the public bar for
 * visitors and guests, the learning tabs' bar for learners adding a goal.
 */
export function OnboardingChromeProvider({
  children,
  chrome,
}: {
  children: ReactNode;
  chrome: ReactNode;
}) {
  return <OnboardingChromeContext value={chrome}>{children}</OnboardingChromeContext>;
}

/**
 * The page behind every onboarding screen: the app's top bar, then the app's background. One
 * centered column on every screen size, with the next step at the bottom.
 */
export function OnboardingFrame({ children, className, ...props }: React.ComponentProps<"div">) {
  const chrome = use(OnboardingChromeContext);

  return (
    <div
      className={cn("bg-background text-foreground flex min-h-dvh flex-col", className)}
      data-slot="onboarding-frame"
      {...props}
    >
      {chrome}
      {children}
    </div>
  );
}

/**
 * A goal's onboarding questions are a task of their own, like a lesson: the page holds only the
 * steps' bar and the screen, without the app's bar, so nothing but the next answer competes.
 */
export function OnboardingTaskFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-background text-foreground flex min-h-dvh flex-col", className)}
      data-slot="onboarding-frame"
      {...props}
    />
  );
}

/** Back to the previous screen, as round as every bar's way back. */
function BackButton({ onBack }: { onBack: () => void }) {
  const t = useExtracted();

  return (
    <Button className="rounded-full" onClick={onBack} size="icon-bar" variant="outline">
      <ChevronLeftIcon aria-hidden="true" className="size-5" />
      <span className="sr-only">{t("Back")}</span>
    </Button>
  );
}

/**
 * Where the learner is in the questions, as segments: the ones answered and the current one filled,
 * announced as "Step 2 of 4".
 */
function StepSegments({ current, total }: OnboardingProgress) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Step {current, number} of {total, number}", { current: current + 1, total })}
      className="flex w-32 gap-1.5 sm:w-48"
      data-slot="step-dots"
      role="img"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors motion-reduce:transition-none",
            index <= current ? "bg-foreground" : "bg-foreground/15",
          )}
          key={index}
        />
      ))}
    </div>
  );
}

/**
 * The steps of this part of onboarding, at the top of the content under the app's bar: back on the
 * left, where the learner is in the middle, and one quiet way out on the right. Nothing shows when
 * there's none of them.
 */
export function OnboardingTopBar({
  end,
  onBack,
  progress,
}: {
  end?: React.ReactNode;
  onBack?: () => void;
  progress?: { current: number; total: number } | null;
}) {
  if (!end && !onBack && !progress) {
    return null;
  }

  return (
    <div className="mx-auto grid min-h-11 w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3 sm:pt-4">
      <div className="justify-self-start">{onBack && <BackButton onBack={onBack} />}</div>

      {progress ? <StepSegments current={progress.current} total={progress.total} /> : <span />}

      <div className="justify-self-end">{end}</div>
    </div>
  );
}

/**
 * The screen's content: one column about 560px wide. On phones its next step sits at the bottom;
 * on wide screens the content and its next step stay together in the middle.
 */
export function OnboardingColumn({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-4 pb-8 sm:pt-8 lg:justify-center-safe lg:pb-16",
        className,
      )}
      data-slot="onboarding-column"
      {...props}
    >
      {children}
    </main>
  );
}

export function OnboardingTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-[28px] leading-tight font-bold tracking-tight text-balance wrap-break-word hyphens-auto [hyphenate-limit-chars:12] sm:text-3xl",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function OnboardingDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-base text-pretty", className)} {...props}>
      {children}
    </p>
  );
}

/**
 * What the screen is about (the exam, the course or the subject) as the eyebrow above the question,
 * with where the learner is in the questions ("ENEM 2026 · Step 2 of 4"). Naming it apart keeps
 * each question natural in every language: an exam's name inside a sentence would need an article
 * that depends on the name ("sobre o ENEM", "über den SAT").
 */
export function OnboardingSubject({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const t = useExtracted();
  const progress = use(OnboardingProgressContext);

  const step =
    progress &&
    t("Step {current, number} of {total, number}", {
      current: progress.current + 1,
      total: progress.total,
    });

  return (
    <p
      className={cn(
        "text-muted-foreground min-w-0 text-[0.8125rem] font-semibold tracking-wide text-pretty wrap-break-word uppercase",
        className,
      )}
    >
      <span>{toLabelCase(children)}</span>
      {step && <span>{` · ${step}`}</span>}
    </p>
  );
}

export function OnboardingHeading({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/**
 * The next step stays in reach at the bottom of the column on phones, above the home indicator,
 * and right under the content on wide screens.
 */
export function OnboardingFooter({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col gap-2 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:mt-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The screen's one main action. Enter presses it from anywhere on the screen unless another control
 * has focus.
 */
export function OnboardingPrimaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const ref = useEnterClick<HTMLButtonElement>({ enabled: !props.disabled });

  return (
    <Button className={cn("h-12 w-full text-base", className)} size="lg" {...props} ref={ref} />
  );
}

/** The screen's quiet second action ("I'm starting from scratch"): plain text under the main one. */
export function OnboardingSecondaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("h-12 w-full text-base", className)}
      size="lg"
      variant="ghost"
      {...props}
    />
  );
}
