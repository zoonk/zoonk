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

const STANDALONE_COLUMN_CLASS = "mx-auto w-full max-w-xl px-4";

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

/** Named apart, since an exam's name inside a sentence would need an article that depends on the name ("sobre o ENEM", "über den SAT"). */
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

export function OnboardingSecondaryButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button className={cn("w-full", className)} size="lg" variant="ghost" {...props} />;
}
