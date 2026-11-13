"use client";

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
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { DETAIL_PRIMARY_CLASS, PAGE_ARTICLE_CLASS } from "../_components/detail-page";
import { EnterButton, EnterLink } from "../_components/enter-button";
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
      <article className={PAGE_ARTICLE_CLASS}>
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

  return t("Today it has {count, number} of its {total, number} questions, about {time}.", {
    count: status.questions,
    time: duration(status.minutes),
    total: status.examQuestions,
  });
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

/** `actionOnPhone` is false when the phone's bottom bar carries the action instead. */
export function ChooserHeader({
  action,
  actionOnPhone = true,
  detail,
  eyebrow,
  status,
  title,
}: {
  action: ReactNode;
  actionOnPhone?: boolean;
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

      <DetailActions className={cn(!actionOnPhone && "max-md:hidden")}>{action}</DetailActions>
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

export function ChooserStartButton({
  busy,
  children,
  disabled = false,
  onClick,
}: {
  busy: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const mounted = useIsMounted();

  return (
    <EnterButton
      busy={busy}
      className={DETAIL_PRIMARY_CLASS}
      disabled={disabled || !mounted}
      icon={<PlayIcon aria-hidden="true" />}
      onClick={onClick}
      size="lg"
    >
      {children}
    </EnterButton>
  );
}

export function ChooserPlusLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <EnterLink className={DETAIL_PRIMARY_CLASS} href={href} icon={null} size="lg">
      {t("See Plus")}
    </EnterLink>
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

/** The exam's name stays over the title, so the title doesn't jump when Start is pressed. */
export function MockWriting({
  bar,
  eyebrow,
  run,
}: {
  bar: ReactNode;
  eyebrow: string;
  run: GenerationRun;
}) {
  const t = useExtracted();

  return (
    <ChooserLayout bar={bar}>
      <GenerationWait kind="mockQuestions" run={run}>
        <div className="flex flex-col gap-1">
          <PageEyebrow>{eyebrow}</PageEyebrow>
          {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- The title's text is its children. */}
          <GenerationTimelineTitle render={<h1 />}>
            {t("Getting your mock exam ready…")}
          </GenerationTimelineTitle>
        </div>
        <GenerationTimelineDescription>
          {t(
            "We're writing questions like the exam's for you. It starts here as soon as they're ready.",
          )}
        </GenerationTimelineDescription>
      </GenerationWait>
    </ChooserLayout>
  );
}
