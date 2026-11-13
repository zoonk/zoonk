"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, useLayoutEffect } from "react";
import { EnterButton } from "../_components/enter-button";
import { PageEyebrow } from "../_components/page";
import { CLEAR_OF_PINNED_ACTIONS_CLASS } from "../_components/pinned-actions";
import { ChangeSaveError } from "../_components/save-error";
import {
  ACTION_BAR_SURFACE_CLASS,
  BAR_PADDING_CLASS,
  TASK_MAIN_ACTION_CLASS,
  TASK_WRAPPING_ACTION_CLASS,
  TaskActions,
} from "../_components/task-layout";
import { toLabelCase } from "../_utils/label-case";
import { OnboardingBarRow, isStepBar } from "./onboarding-bar";
import {
  NO_BAR,
  type OnboardingBar,
  OnboardingScreenProvider,
  useOnboardingHost,
  useOnboardingScreen,
  useOnboardingSection,
} from "./onboarding-host";
import {
  OnboardingBottomBar,
  OnboardingScreenPage,
  OnboardingSectionFrame,
} from "./onboarding-page";
import { useOnboardingRail } from "./onboarding-rail";

export { OnboardingEmbedded, OnboardingPage } from "./onboarding-host";

const STANDALONE_COLUMN_CLASS = "mx-auto w-full max-w-xl px-4";

export function OnboardingFrame({
  bar = NO_BAR,
  children,
  failure = null,
  notice = null,
}: {
  bar?: OnboardingBar;
  children: ReactNode;
  /** What the last action couldn't do, said over the screen's actions, where it moves nothing. */
  failure?: ReactNode;
  notice?: ReactNode;
}) {
  const host = useOnboardingHost();

  if (host?.kind === "page") {
    return (
      <OnboardingScreenProvider value={{ bar, failure, notice }}>
        {children}
      </OnboardingScreenProvider>
    );
  }

  if (host?.kind === "section") {
    return (
      <OnboardingSectionFrame bar={bar} header={host.header} notice={notice}>
        <OnboardingScreenProvider value={{ bar, failure, notice: null }}>
          {children}
        </OnboardingScreenProvider>
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
      <OnboardingScreenProvider value={{ bar, failure, notice: null }}>
        {children}
      </OnboardingScreenProvider>
    </div>
  );
}

export function OnboardingColumn({
  bar,
  children,
  className,
  rail,
  wide = false,
  ...props
}: React.ComponentProps<"main"> & {
  /**
   * The screen's actions, the only place they go: pinned at the screen's bottom, so no screen is
   * too long for them. Pass `OnboardingActions`.
   */
  bar?: ReactNode;
  rail?: ReactNode;
  wide?: boolean;
}) {
  const host = useOnboardingHost();
  const flowRail = useOnboardingRail();

  if (host?.kind === "page") {
    return (
      <OnboardingScreenPage
        backHref={host.backHref}
        barEnd={host.barEnd}
        bottomBar={bar}
        rail={rail === undefined ? flowRail : rail}
        wide={wide}
      >
        <section
          className={cn(
            "flex w-full min-w-0 flex-1 flex-col gap-6",
            CLEAR_OF_PINNED_ACTIONS_CLASS,
            className,
          )}
          data-slot="onboarding-column"
          {...props}
        >
          {children}
        </section>
      </OnboardingScreenPage>
    );
  }

  if (host?.kind === "section") {
    return (
      <section
        className={cn("flex w-full flex-col gap-6", className)}
        data-slot="onboarding-column"
        {...props}
      >
        {children}

        <OnboardingBottomBar>{bar}</OnboardingBottomBar>
      </section>
    );
  }

  return (
    <main
      className={cn(STANDALONE_COLUMN_CLASS, "flex flex-1 flex-col pt-4 sm:pt-8")}
      data-slot="onboarding-column"
      {...props}
    >
      <div className={cn("flex min-w-0 flex-1 flex-col gap-6 pb-8 lg:pb-16", className)}>
        {children}
      </div>

      <OnboardingBottomBar className={cn(ACTION_BAR_SURFACE_CLASS, BAR_PADDING_CLASS, "-mx-4 px-4")}>
        {bar}
      </OnboardingBottomBar>
    </main>
  );
}

export function OnboardingTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  const section = useOnboardingSection();

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
 * Named apart, since an exam's name inside a sentence would need an article that depends on the
 * name ("sobre o ENEM", "über den SAT").
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
  return (
    <PageEyebrow className={cn("min-w-0 text-pretty wrap-break-word", className)}>
      <span>{toLabelCase(children)}</span>
      {position && (
        <>
          <span aria-hidden="true">{" · "}</span>
          <span>{position}</span>
        </>
      )}
    </PageEyebrow>
  );
}

export function OnboardingHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const host = useOnboardingHost();
  const { bar } = useOnboardingScreen();

  if (host?.kind === "page") {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1 *:data-[slot=onboarding-description]:pt-1",
          // A step keeps the eyebrow's line when it has none, so every step's title is at one height.
          isStepBar(bar) && "first:not-has-[>[data-slot=page-eyebrow]]:pt-5",
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
 * A screen's actions, for `OnboardingColumn`'s `bar`: the other action, then the main one. A save
 * that failed and a `note` about the actions are said over them.
 */
export function OnboardingActions({
  children,
  failed = false,
  note,
}: {
  children: ReactNode;
  failed?: boolean;
  note?: ReactNode;
}) {
  return (
    <>
      {failed && <ChangeSaveError />}
      {note}
      <TaskActions>{children}</TaskActions>
    </>
  );
}

/** A quiet line about the actions, for `OnboardingActions`' `note`. */
export function OnboardingActionsNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm text-pretty lg:text-right">{children}</p>;
}

/** The screen's main action: one look with a lesson's, and Enter presses it. */
export function OnboardingPrimaryButton({
  children,
  ...props
}: React.ComponentProps<typeof EnterButton>) {
  const ref = useEnterClick<HTMLButtonElement>({ enabled: !props.disabled && !props.busy });

  return (
    <EnterButton {...props} ref={ref}>
      {children}
    </EnterButton>
  );
}

/** Alone, or after the row's other actions, it fills a phone's line as a main action would. */
const OTHER_ACTION_CLASS = cn(TASK_WRAPPING_ACTION_CLASS, "max-lg:last:grow");

/** The other action, before the main one: Skip, Not now. */
export function OnboardingSecondaryButton({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <Button
      className={cn(OTHER_ACTION_CLASS, className)}
      focusableWhenDisabled
      size="xl"
      variant="outline"
      {...props}
    />
  );
}

/** A link drawn as the main action or as the one beside it. */
export const ONBOARDING_ACTION_LINK_CLASS = {
  main: cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS),
  other: cn(buttonVariants({ size: "xl", variant: "outline" }), OTHER_ACTION_CLASS),
} as const;

/** The window keeps the scroll of a long screen, so the next one would open past its title. */
export function OnboardingScreenTop() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return null;
}
