"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DetailActions,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "@zoonk/ui/components/detail";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { Page, PageEyebrow } from "../_components/page";
import { StatusRegion } from "../_components/status-region";
import { useFormatDuration } from "../_utils/time-format";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { ABOVE_BOTTOM_TABS_CLASS } from "../shell/learn-navigation";
import { PageWithAside } from "../shell/learn-shell";
import { type MockChooserStatus } from "./mock-chooser-parts";

type MockShortStatus = Extract<MockChooserStatus, { kind: "short" }>;

export function ChooserLayout({
  aside,
  asideClassName,
  bar,
  children,
}: {
  aside?: ReactNode;
  asideClassName?: string;
  bar: ReactNode;
  children: ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={aside}
      asideClassName={asideClassName}
      asideLabel={t("The picked mock exam")}
    >
      <article className="flex min-w-0 flex-col gap-8">
        {bar}
        <Page className="gap-8">{children}</Page>
      </article>
    </PageWithAside>
  );
}

function useFailureText() {
  const t = useExtracted();

  return (reason: Extract<MockChooserStatus, { kind: "failed" }>["reason"]): string =>
    reason === "notEnoughQuestions"
      ? t("Not enough questions for this one yet. Pick another.")
      : t("We couldn't start the mock exam. Try again.");
}

function ShortText({ status }: { status: MockShortStatus }) {
  const t = useExtracted();
  const duration = useFormatDuration();

  return t(
    "This one is shorter today: {count, plural, one {# question} other {# questions}}, about {time}.",
    { count: status.questions, time: duration(status.minutes) },
  );
}

function ChooserLine({ detail, status }: { detail: string; status: MockChooserStatus }) {
  const failureText = useFailureText();

  return (
    <p
      className={cn(
        "pt-1 text-sm text-pretty",
        status.kind === "failed" ? "text-destructive-text" : "text-muted-foreground",
      )}
      role="status"
    >
      {status.kind === "short" && <ShortText status={status} />}
      {status.kind === "failed" && failureText(status.reason)}
      {status.kind !== "short" && status.kind !== "failed" && detail}
    </p>
  );
}

export function ChooserHeader({
  action,
  detail,
  eyebrow,
  status,
  title,
}: {
  action: ReactNode;
  detail: string;
  eyebrow: string;
  status: MockChooserStatus;
  title: string;
}) {
  return (
    <DetailHero>
      <DetailHeroText>
        <PageEyebrow>{eyebrow}</PageEyebrow>
        <DetailTitle>{title}</DetailTitle>
        <ChooserLine detail={detail} status={status} />
      </DetailHeroText>

      <DetailActions>{action}</DetailActions>
    </DetailHero>
  );
}

/** Phones and tablets keep Start in reach after the list: the choice comes before the action. */
export function ChooserBottomBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "bg-background sticky z-20 -mx-4 flex border-t px-4 py-3 md:hidden",
        ABOVE_BOTTOM_TABS_CLASS,
      )}
      data-slot="mock-chooser-bar"
    >
      {children}
    </div>
  );
}

/** Drawn twice (beside the title on wide screens, in the bottom bar otherwise); one takes Enter. */
export function ChooserStartButton({
  busy,
  children,
  disabled = false,
  enter = true,
  onClick,
}: {
  busy: boolean;
  children: ReactNode;
  disabled?: boolean;
  enter?: boolean;
  onClick: () => void;
}) {
  const mounted = useIsMounted();
  const isDisabled = disabled || !mounted;
  const ref = useEnterClick<HTMLButtonElement>({ enabled: enter && !isDisabled && !busy });

  return (
    <Button
      aria-keyshortcuts={enter ? "Enter" : undefined}
      busy={busy}
      className={cn(DETAIL_PRIMARY_CLASS, "font-[560]")}
      disabled={isDisabled}
      focusableWhenDisabled
      icon={<PlayIcon aria-hidden="true" />}
      onClick={onClick}
      ref={ref}
      size="lg"
    >
      {children}
      {enter && <ShortcutKbd tone="inverse">⏎</ShortcutKbd>}
    </Button>
  );
}

export function ChooserPlusLink({ href }: { href: string }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      aria-keyshortcuts="Enter"
      className={cn(DETAIL_PRIMARY_CLASS, "font-[560]")}
      href={href}
      ref={ref}
    >
      {t("See Plus")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

export function ChooserRefusal({ busy, status }: { busy: boolean; status: MockChooserStatus }) {
  const routes = useLearnRoutes();

  return (
    <StatusRegion>
      {!busy && status.kind === "refused" && (
        <HelpLimitNotice limit={status.limit} linkComponent={LearnLink} routes={routes} />
      )}
    </StatusRegion>
  );
}

export function MockWriting({ bar, run }: { bar: ReactNode; run: GenerationRun }) {
  const t = useExtracted();

  return (
    <ChooserLayout bar={bar}>
      <GenerationWait kind="mockQuestions" run={run}>
        {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- The title's text is its children. */}
        <GenerationTimelineTitle render={<h1 />}>
          {t("Getting your mock exam ready…")}
        </GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t("It starts here when it's ready.")}
        </GenerationTimelineDescription>
      </GenerationWait>
    </ChooserLayout>
  );
}
