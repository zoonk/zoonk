"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { type ReactNode } from "react";
import { PageSectionTitle } from "../../_components/page";
import { LearnLink } from "../../learn-link";
import { useWaitBack, useWaitPlace } from "../../wait/wait-screen";
import { OnboardingDescription, OnboardingHeading, OnboardingTitle } from "../onboarding-frame";
import {
  OnboardingScreenProvider,
  useOnboardingHost,
  useOnboardingScreen,
} from "../onboarding-host";

/** The progress view's heading: the page's title, or a block's title in the aside. */
export function WaitHeading({ description, title }: { description: ReactNode; title: string }) {
  const place = useWaitPlace();

  if (place === "aside") {
    return (
      <div className="flex flex-col gap-1">
        <PageSectionTitle>{title}</PageSectionTitle>
        <p className="text-muted-foreground text-sm text-pretty">{description}</p>
      </div>
    );
  }

  return (
    <OnboardingHeading>
      <OnboardingTitle>{title}</OnboardingTitle>
      <OnboardingDescription>{description}</OnboardingDescription>
    </OnboardingHeading>
  );
}

/** A wait's bar: the Library's way out on the left, a note over the slot's action on the right. */
export function WaitBar({
  children,
  library,
  note,
}: {
  children: ReactNode;
  library?: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      {library}

      <div className={cn("flex flex-col gap-2 lg:items-end", !library && "lg:ml-auto")}>
        {note && (
          <p className="text-muted-foreground text-center text-sm text-pretty lg:text-right">
            {note}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

/** The bar's Back and Esc close the progress as the browser's Back does, instead of leaving. */
export function WaitBackToQuiz({ children }: { children: ReactNode }) {
  const screen = useOnboardingScreen();
  const back = useWaitBack();
  const host = useOnboardingHost();

  if (!back || host?.kind !== "page") {
    return children;
  }

  return (
    <OnboardingScreenProvider value={{ ...screen, bar: { ...screen.bar, onBack: back } }}>
      {children}
    </OnboardingScreenProvider>
  );
}

/** A written lesson the wait offers, its main action: Enter opens it as it does a button. */
export function WaitLinkAction({ children, href }: { children: ReactNode; href: string }) {
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "lg" }), "w-full font-[560] lg:w-auto lg:min-w-40")}
      href={href}
      lessonWritten
      ref={ref}
    >
      <PlayIcon aria-hidden="true" data-icon="inline-start" />
      {children}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}
