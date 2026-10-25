"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { PageEyebrow } from "../_components/page";
import { toLabelCase } from "../_utils/label-case";
import { OnboardingBarRow } from "./onboarding-bar";
import {
  NO_BAR,
  type OnboardingBar,
  OnboardingScreenProvider,
  useOnboardingHost,
  useOnboardingSection,
} from "./onboarding-host";
import { OnboardingScreenPage, OnboardingSectionFrame } from "./onboarding-page";
import { useOnboardingRail } from "./onboarding-rail";
import { PlanStartNoticeSlot } from "./steps/plan-start-notice";

export { OnboardingEmbedded, OnboardingPage } from "./onboarding-host";

/** A screen of its own: one centered column about 560px wide, its bar on the same edges. */
const STANDALONE_COLUMN_CLASS = "mx-auto w-full max-w-xl px-4";

/**
 * The page behind every onboarding screen, with the flow's bar (`bar`) and a line over the screen
 * (`notice`: a save that failed). On a page of the app's frame each screen draws the page from
 * them (`OnboardingColumn`); under a host's title they follow its top; a screen of its own puts
 * the bar over one centered column.
 */
export function OnboardingFrame({
  bar = NO_BAR,
  children,
  notice = null,
}: {
  bar?: OnboardingBar;
  children: ReactNode;
  notice?: ReactNode;
}) {
  const host = useOnboardingHost();

  if (host?.kind === "page") {
    return <OnboardingScreenProvider value={{ bar, notice }}>{children}</OnboardingScreenProvider>;
  }

  if (host?.kind === "section") {
    return (
      <OnboardingSectionFrame bar={bar} header={host.header} notice={notice}>
        {children}
      </OnboardingSectionFrame>
    );
  }

  return (
    <div
      className="bg-background text-foreground flex min-h-dvh flex-col"
      data-slot="onboarding-frame"
    >
      <OnboardingBarRow bar={bar} className={cn(STANDALONE_COLUMN_CLASS, "pt-3 sm:pt-4")} />
      {notice}
      {children}
    </div>
  );
}

/**
 * The screen's content, from the top like any working screen: what it asks, then the answer and
 * the next step under it, so the eye reads down from the question to its options to the button.
 * On phones its next step sits at the bottom, from tablets it follows the content. On a page of
 * the app's frame it draws the page (`OnboardingScreenPage`): from `lg` a task's column centered
 * in the page, with the flow's rail in its aside from 72rem (`rail` puts the screen's own there;
 * `null`, none); a `wide` screen, such as the plan's reveal, fills the room. Under a host's title
 * it's a section at the page's edges; on a screen of its own, one centered column.
 */
export function OnboardingColumn({
  children,
  className,
  rail,
  wide = false,
  ...props
}: React.ComponentProps<"main"> & { rail?: ReactNode; wide?: boolean }) {
  const host = useOnboardingHost();
  const flowRail = useOnboardingRail();

  if (host?.kind === "page") {
    return (
      <OnboardingScreenPage
        backHref={host.backHref}
        barEnd={host.barEnd}
        rail={rail === undefined ? flowRail : rail}
        wide={wide}
      >
        <section
          className={cn("flex w-full min-w-0 flex-1 flex-col gap-6", className)}
          data-slot="onboarding-column"
          {...props}
        >
          {children}
        </section>
      </OnboardingScreenPage>
    );
  }

  // Under a host's title the host's `main` and edges hold it: the page's column, from its edge.
  if (host?.kind === "section") {
    return (
      <section
        className={cn("lg:max-w-column flex w-full flex-col gap-6", className)}
        data-slot="onboarding-column"
        {...props}
      >
        {children}
      </section>
    );
  }

  return (
    <main
      className={cn(STANDALONE_COLUMN_CLASS, "flex flex-1 flex-col pt-4 pb-8 sm:pt-8 lg:pb-16")}
      data-slot="onboarding-column"
      {...props}
    >
      <div className={cn("flex min-w-0 flex-1 flex-col gap-6", className)}>{children}</div>
    </main>
  );
}

export function OnboardingTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  const section = useOnboardingSection();

  // Under the host's own title, the screen's title is a section's.
  if (section) {
    return (
      <h2
        className={cn("text-xl leading-snug font-semibold text-pretty outline-none", className)}
        data-slot="onboarding-title"
        tabIndex={-1}
        {...props}
      >
        {children}
      </h2>
    );
  }

  return (
    <h1
      className={cn(
        "text-title wrap-break-word hyphens-auto outline-none [hyphenate-limit-chars:12]",
        className,
      )}
      data-slot="onboarding-title"
      tabIndex={-1}
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
      className={cn("text-muted-foreground text-sm text-pretty", className)}
      data-slot="onboarding-description"
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * What the screen is about (the exam, the course or the subject) as the eyebrow above the question,
 * with the question's number on a test, whose bar shows how far along it is but not which question
 * (`position`: "ENEM 2026 · Question 3" in placement); on a page of the app's frame it's the page's
 * eyebrow. Naming it apart keeps each question natural in every language: an exam's name inside a
 * sentence would need an article that depends on the name ("sobre o ENEM", "über den SAT").
 */
export function OnboardingSubject({
  children,
  className,
  position,
}: {
  children: string;
  className?: string;
  position?: string;
}) {
  const host = useOnboardingHost();

  const content = (
    <>
      <span>{toLabelCase(children)}</span>
      {position && (
        <>
          <span aria-hidden="true">{" · "}</span>
          <span>{position}</span>
        </>
      )}
    </>
  );

  if (host?.kind === "page") {
    return (
      <PageEyebrow className={cn("min-w-0 text-pretty wrap-break-word", className)}>
        {content}
      </PageEyebrow>
    );
  }

  return (
    <p className={cn("text-label min-w-0 text-pretty wrap-break-word", className)}>{content}</p>
  );
}

/**
 * The screen's title, what it's about over it and its one line under it. On a page of the app's
 * frame it's laid out as the page's header (`PageHeaderContent`): opening the screen, it keeps the
 * eyebrow's line even when it's empty, so the title sits where every page's does.
 */
export function OnboardingHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const host = useOnboardingHost();

  if (host?.kind === "page") {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1 first:not-has-[>[data-slot=page-eyebrow]]:pt-5 *:data-[slot=onboarding-description]:pt-1",
          className,
        )}
        data-slot="onboarding-heading"
      >
        {children}
      </div>
    );
  }

  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

/**
 * The next step stays in reach at the bottom of the column on phones (above the home indicator;
 * the app's frame has no tab bar under onboarding), and right under the content from
 * tablets, where the bottom of the screen is far from it.
 */
export function OnboardingFooter({ children, className, ...props }: React.ComponentProps<"div">) {
  const standalone = useOnboardingHost() === null;

  return (
    <div
      className={cn(
        "mt-auto flex flex-col gap-2 pt-4 sm:mt-0",
        standalone && "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    >
      <PlanStartNoticeSlot />
      {children}
    </div>
  );
}

/**
 * The screen's one main action, with its ⏎ hint where there's a keyboard. Enter presses it from
 * anywhere on the screen unless another control has focus.
 */
export function OnboardingPrimaryButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const ref = useEnterClick<HTMLButtonElement>({ enabled: !props.disabled });

  return (
    <Button
      aria-keyshortcuts="Enter"
      className={cn("w-full font-[560]", className)}
      size="lg"
      {...props}
      ref={ref}
    >
      {children}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </Button>
  );
}

/** The screen's quiet second action ("I'm starting from scratch"): plain text under the main one. */
export function OnboardingSecondaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button className={cn("w-full", className)} size="lg" variant="ghost" {...props} />;
}
