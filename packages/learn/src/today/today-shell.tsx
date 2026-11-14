"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { METER_PARTS_CLASS } from "@zoonk/ui/components/meter";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { PageWithAside } from "../shell/learn-shell";
import { TODAY_ASIDE_CLASS, TODAY_MAIN_CLASS } from "./today-layout";

const SHELL_ROWS = 5;

function DayRowsSkeleton() {
  return (
    <div className="mt-3 flex flex-col">
      {Array.from({ length: SHELL_ROWS }, (_, index) => (
        <div className="flex items-center gap-3 border-b py-2.75 last:border-b-0" key={index}>
          <Skeleton className="mx-0.5 size-3 shrink-0 rounded-full" />
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
      bottomBar={
        <BottomBar>
          <BottomBarActions>
            <Skeleton className="h-11 w-full rounded-lg lg:w-40" />
          </BottomBarActions>
        </BottomBar>
      }
    >
      <Page>
        <div className={TODAY_MAIN_CLASS}>
          <PageHeader>
            <PageHeaderContent className="w-full">
              <PageTitle>{t("Today")}</PageTitle>
            </PageHeaderContent>
          </PageHeader>

          <div className="mt-5 flex flex-col">
            <div className={METER_PARTS_CLASS}>
              <Skeleton className="h-full w-full rounded-full" />
            </div>

            <DayRowsSkeleton />
          </div>
        </div>
      </Page>
    </PageWithAside>
  );
}
