"use client";

import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { PlayIcon } from "lucide-react";
import { type ReactNode } from "react";
import { PageSectionTitle } from "../../_components/page";
import { LearnLink } from "../../learn-link";
import { useWaitBack, useWaitPlace } from "../../wait/wait-screen";
import {
  ONBOARDING_ACTION_LINK_CLASS,
  OnboardingActions,
  OnboardingActionsNote,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
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

/** A wait's bar: its actions, with the Library's way out before them on a computer's row. */
export function WaitBar({
  children,
  failed,
  library,
  note,
}: {
  children: ReactNode;
  failed?: boolean;
  library?: ReactNode;
  note?: string | null;
}) {
  const actions = (
    <OnboardingActions
      failed={failed}
      note={note && <OnboardingActionsNote>{note}</OnboardingActionsNote>}
    >
      {children}
    </OnboardingActions>
  );

  if (!library) {
    return actions;
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      {library}
      <div className="flex flex-col gap-2 not-has-[a,button,p]:hidden lg:items-end">{actions}</div>
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
    <LearnLink className={ONBOARDING_ACTION_LINK_CLASS.main} href={href} lessonWritten ref={ref}>
      <PlayIcon aria-hidden="true" data-icon="inline-start" />
      {children}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}
