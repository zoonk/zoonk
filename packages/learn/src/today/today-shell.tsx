"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { METER_PARTS_CLASS } from "@zoonk/ui/components/meter";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { GOAL_RING_SIZE_CLASS } from "../_components/goal-ring";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { WEEK_DAY_CLASS, WEEK_ROW_CLASS, WeekDayLetterSkeleton } from "../_components/week-row";
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

function TodayAsideSkeleton() {
  return (
    <div aria-hidden="true" className="contents">
      <div className="flex min-h-16 items-center gap-3 px-4">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28 rounded-sm" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="my-1 h-4 w-20 rounded-sm" />
        <div className={WEEK_ROW_CLASS}>
          {Array.from({ length: 7 }, (_, day) => (
            <div className={WEEK_DAY_CLASS} key={day}>
              <Skeleton className={`${GOAL_RING_SIZE_CLASS} rounded-full`} />
              <WeekDayLetterSkeleton />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="my-1 h-4 w-24 rounded-sm" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex flex-col gap-3 min-[72rem]:hidden">
        <Skeleton className="my-1 h-4 w-28 rounded-sm" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function TodayShell() {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={<TodayAsideSkeleton />}
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
