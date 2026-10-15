"use client";

import { useExtracted } from "next-intl";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { PageWithAside } from "../shell/learn-shell";
import { TODAY_ASIDE_CLASS, TODAY_MAIN_CLASS } from "./today-layout";

/**
 * Today's frame before the learner's day arrives, on a hard load (a client navigation paints
 * Today from its prefetch): the title where Today has it, and the aside's place beside the column
 * from 72rem, so the column keeps its width. No placeholders and no headings over nothing: the day
 * streams into the same response and takes the page without moving the title.
 */
export function TodayShell() {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={<div aria-hidden="true" />}
      asideClassName={TODAY_ASIDE_CLASS}
      asideLabel={t("Your week")}
    >
      <Page>
        <div className={TODAY_MAIN_CLASS}>
          <PageHeader className="[grid-area:head]">
            {/* Without the date line, the title keeps its height on its own (`PageHeaderContent`). */}
            <PageHeaderContent className="w-full">
              <PageTitle>{t("Today")}</PageTitle>
            </PageHeaderContent>
          </PageHeader>
        </div>
      </Page>
    </PageWithAside>
  );
}
