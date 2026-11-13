"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { DETAIL_PRIMARY_CLASS, PAGE_ARTICLE_CLASS } from "../_components/detail-page";
import { EnterButton } from "../_components/enter-button";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { Page } from "../_components/page";
import { GateWords, SubscribeMainAction } from "../_components/subscribe-gate";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { PageWithAside } from "../shell/learn-shell";
import { type MockChooserStatus } from "./mock-chooser-parts";

export function ChooserLayout({
  aside,
  asideClassName,
  bar,
  bottomBar,
  children,
}: {
  aside?: ReactNode;
  asideClassName?: string;
  bar: ReactNode;
  bottomBar?: ReactNode;
  children: ReactNode;
}) {
  const t = useExtracted();

  return (
    <>
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
      {bottomBar}
    </>
  );
}

function useFailureText() {
  const t = useExtracted();

  return (reason: Extract<MockChooserStatus, { kind: "failed" }>["reason"]): string =>
    reason === "notEnoughQuestions"
      ? t("Not enough questions for this one yet. Pick another.")
      : t("We couldn't start the mock exam. Try again.");
}

export function ChooserHeader({ detail, title }: { detail: string; title: string }) {
  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{title}</DetailTitle>
        <p className="text-muted-foreground pt-1 text-sm text-pretty">{detail}</p>
      </DetailHeroText>
    </DetailHero>
  );
}

/** Why Start didn't start, read out as it shows: over the bar, where the learner pressed. */
function useChooserNote({ busy, gated, status }: ChooserBarProps): ReactNode {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const failureText = useFailureText();

  if (gated) {
    return (
      <div role="alert">
        <GateWords title={t("Mock exams need a subscription")} />
      </div>
    );
  }

  if (busy) {
    return null;
  }

  if (status.kind === "refused") {
    return (
      <div role="alert">
        <HelpLimitNotice limit={status.limit} linkComponent={LearnLink} routes={routes} />
      </div>
    );
  }

  if (status.kind === "failed") {
    return (
      <p className="text-destructive-text text-sm text-pretty" role="alert">
        {failureText(status.reason)}
      </p>
    );
  }

  return null;
}

type ChooserBarProps = { busy: boolean; gated: boolean; status: MockChooserStatus };

/** Start on every screen size, after the list: the choice comes before the action. */
export function ChooserBar({
  busy,
  disabled,
  gated,
  onStart,
  status,
}: ChooserBarProps & { disabled: boolean; onStart: () => void }) {
  const t = useExtracted();
  const mounted = useIsMounted();
  const note = useChooserNote({ busy, gated, status });

  return (
    <BottomBar note={note}>
      {gated ? (
        <SubscribeMainAction />
      ) : (
        <BottomBarActions>
          <EnterButton
            busy={busy}
            className={DETAIL_PRIMARY_CLASS}
            disabled={disabled || !mounted}
            onClick={onStart}
            size="lg"
          >
            {t("Start")}
          </EnterButton>
        </BottomBarActions>
      )}
    </BottomBar>
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
          {t(
            "We're writing questions like the exam's for you. It starts here as soon as they're ready.",
          )}
        </GenerationTimelineDescription>
      </GenerationWait>
    </ChooserLayout>
  );
}
