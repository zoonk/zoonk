"use client";

import { GenerationTimelineDescription } from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { TodayEyebrow } from "./today-heading";

export function TodayPreparing({
  goalTitle,
  onRefresh,
  run,
}: {
  goalTitle: string;
  onRefresh: () => void;
  run: GenerationRun;
}) {
  const t = useExtracted();

  useRefreshUntilShown({ isReady: run.status === "ready", refresh: onRefresh });

  return (
    <Page data-slot="today-preparing">
      <PageHeader>
        <PageHeaderContent>
          <TodayEyebrow>
            <span>{t("Building your plan")}</span>
          </TodayEyebrow>
          <PageTitle>{t("Today")}</PageTitle>
        </PageHeaderContent>
      </PageHeader>

      <section className="max-w-column flex w-full flex-col gap-8">
        <GenerationWait kind="firstLesson" run={run}>
          <h2 className="text-[0.9375rem] leading-snug font-semibold wrap-break-word">
            {t("Building your plan for {goal}", { goal: goalTitle })}
          </h2>
          <GenerationTimelineDescription>
            {t(
              "It usually takes a minute or two. Your first day opens here as soon as it's ready.",
            )}
          </GenerationTimelineDescription>
        </GenerationWait>
      </section>
    </Page>
  );
}
