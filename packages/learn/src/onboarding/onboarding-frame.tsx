"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, createContext, use } from "react";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { toLabelCase } from "../_utils/label-case";

const OnboardingChromeContext = createContext<ReactNode>(null);

/**
 * The app's own top bar for every onboarding page, from the host's layout: the public bar for
 * visitors and guests, the learning tabs' bar for learners adding a goal. Each screen places it
 * inside its own mode, so choosing Fun turns the bar Fun with the rest of the page.
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
 * The page behind every onboarding screen: the app's top bar, then the app's background in Focus,
 * deep space in Fun. One centered column on every screen size, with the next step at
 * the bottom.
 */
export function OnboardingFrame({ children, className, ...props }: React.ComponentProps<"div">) {
  const chrome = use(OnboardingChromeContext);

  return (
    <div
      className={cn(
        "bg-background text-foreground in-data-[mode=fun]:fun-space flex min-h-dvh flex-col",
        className,
      )}
      data-slot="onboarding-frame"
      {...props}
    >
      {chrome}
      {children}
    </div>
  );
}

/** Dots for the screens of this part of onboarding; the current one is a longer pill. */
function StepDots({ current, total }: { current: number; total: number }) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Step {current, number} of {total, number}", { current: current + 1, total })}
      className="flex items-center gap-1.5"
      role="img"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={cn(
            "bg-foreground/20 h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
            index === current ? "bg-foreground in-data-[mode=fun]:bg-fun-lime w-5" : "w-1.5",
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
  const t = useExtracted();

  if (!end && !onBack && !progress) {
    return null;
  }

  return (
    <div className="mx-auto grid min-h-11 w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-2 sm:pt-4">
      <div className="justify-self-start">
        {onBack && (
          <Button
            aria-label={t("Back")}
            className="in-data-[mode=fun]:fun-glass"
            onClick={onBack}
            size="icon"
            variant="ghost"
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
        )}
      </div>

      {progress ? <StepDots current={progress.current} total={progress.total} /> : <span />}

      <div className="justify-self-end">{end}</div>
    </div>
  );
}

/** The screen's content: one column about 560px wide. */
export function OnboardingColumn({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-4 pb-8 sm:pt-8",
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
        "text-[28px] leading-tight font-semibold tracking-tight text-balance wrap-break-word hyphens-auto [hyphenate-limit-chars:12] sm:text-3xl",
        "in-data-[mode=fun]:font-fun-display in-data-[mode=fun]:font-bold in-data-[mode=fun]:tracking-normal",
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
    <p
      className={cn(
        "text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-base text-pretty",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * What the screen is about (the exam, the course or the subject) as a quiet label above the
 * question. Naming it apart keeps each question natural in every language: an exam's name inside
 * a sentence would need an article that depends on the name ("sobre o ENEM", "über den SAT").
 */
export function OnboardingSubject({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "bg-muted text-muted-foreground in-data-[mode=fun]:bg-fun-soft in-data-[mode=fun]:text-fun-fg2 min-w-0 self-start rounded-xl px-3 py-1 text-xs font-medium text-pretty wrap-break-word",
        className,
      )}
    >
      {toLabelCase(children)}
    </p>
  );
}

export function OnboardingHeading({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/** The next step stays in reach at the bottom of the column, above the home indicator. */
export function OnboardingFooter({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col gap-2 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The screen's one main action: the primary button in Focus, the lime pill in Fun. Enter presses
 * it from anywhere on the screen unless another control has focus.
 */
export function OnboardingPrimaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const primaryVariant = usePrimaryVariant();
  const ref = useEnterClick<HTMLButtonElement>({ enabled: !props.disabled });

  return (
    <Button
      className={cn("h-12 w-full text-base", className)}
      size="lg"
      variant={primaryVariant}
      {...props}
      ref={ref}
    />
  );
}

export function OnboardingSecondaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("in-data-[mode=fun]:fun-glass h-12 w-full text-base", className)}
      size="lg"
      variant="outline"
      {...props}
    />
  );
}
