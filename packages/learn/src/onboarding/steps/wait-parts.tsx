"use client";

import { PlayIcon } from "lucide-react";
import { type ReactNode } from "react";
import { EnterLink } from "../../_components/enter-button";
import { PageSectionTitle } from "../../_components/page";
import { useWaitBack, useWaitPlace } from "../../wait/wait-screen";
import {
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
  return (
    <EnterLink href={href} icon={<PlayIcon aria-hidden="true" />} lessonWritten>
      {children}
    </EnterLink>
  );
}
