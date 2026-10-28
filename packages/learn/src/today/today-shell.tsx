"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { METER_PARTS_CLASS } from "../_components/meter";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { PageWithAside } from "../shell/learn-shell";
import { TODAY_ACTION_CLASS, TODAY_ASIDE_CLASS, TODAY_MAIN_CLASS } from "./today-layout";

const SHELL_ROWS = 5;

function DayRowsSkeleton() {
  return (
    <div className="mt-3 flex flex-col">
      {Array.from({ length: SHELL_ROWS }, (_, index) => (
        <div className="flex items-center gap-3 border-b py-2.75 last:border-b-0" key={index}>
          <Skeleton className="size-3 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5 rounded-sm" />
            <Skeleton className="h-3 w-1/4 rounded-sm" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

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
            <PageHeaderContent className="w-full">
              <PageTitle>{t("Today")}</PageTitle>
            </PageHeaderContent>
          </PageHeader>

          <div className="mt-5 flex flex-col [grid-area:session]">
            <div className={METER_PARTS_CLASS}>
              <Skeleton className="h-full w-full rounded-full" />
            </div>
            <Skeleton className="mt-2 h-3 w-40 rounded-sm" />

            <DayRowsSkeleton />
          </div>

          <div className={TODAY_ACTION_CLASS}>
            <Skeleton className="h-11 w-full rounded-lg sm:w-40" />
          </div>
        </div>
      </Page>
    </PageWithAside>
  );
}
