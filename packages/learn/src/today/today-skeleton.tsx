"use client";

import { ButtonSkeleton } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import {
  Page,
  PageHeader,
  PageHeaderContent,
  PageSectionHeader,
  PageSectionTitle,
  PageTitle,
} from "../_components/page";
import { PageWithAside } from "../shell/learn-shell";
import { TODAY_ASIDE_CLASS, TODAY_MAIN_CLASS } from "./today-layout";

const QUEUE_ROWS = 6;
const WEEK_DAYS = 7;
const AREA_ROWS = 4;

/** One block of the queue: its dot, its name over what it's part of, its minutes. */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b py-2.75 last:border-b-0">
      <Skeleton className="size-2 shrink-0 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <Skeleton className="my-0.5 h-4 w-48 max-w-full rounded-md" />
        <Skeleton className="my-0.5 h-3 w-32 rounded-md" />
      </span>
      <Skeleton className="h-3 w-9 shrink-0 rounded-md" />
    </div>
  );
}

/** The week's block: its label, the time, and the seven rings with their letters. */
function WeekSkeleton() {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3 min-[72rem]:order-first">
      <PageSectionHeader>
        <PageSectionTitle>{t("This week")}</PageSectionTitle>
        <Skeleton className="h-3 w-16 rounded-sm" />
      </PageSectionHeader>
      <Skeleton className="-mt-1 hidden h-7 w-28 rounded-md sm:block" />
      <div className="grid grid-cols-7 gap-1 py-1">
        {Array.from({ length: WEEK_DAYS }, (_, day) => (
          <span className="flex min-h-11 flex-col items-center gap-1.5 py-1" key={day}>
            <Skeleton className="size-7.5 rounded-full" />
            <Skeleton className="h-3 w-2 rounded-sm" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The preparation's block: its label, the number and a few areas with their bars. */
function PreparationSkeleton() {
  return (
    <div className="flex flex-col gap-3 max-sm:hidden min-[72rem]:order-first">
      <span className="flex h-6 items-center">
        <Skeleton className="h-3.5 w-24 rounded-md" />
      </span>
      <Skeleton className="-mt-1 h-7 w-16 rounded-md" />
      <div className="flex flex-col">
        {Array.from({ length: AREA_ROWS }, (_, row) => (
          <span
            className="grid h-7.5 grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] items-center gap-3"
            key={row}
          >
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-1 rounded-[2px]" />
            <Skeleton className="h-3 rounded-md" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Today's header: its title as Today has it, the date line (a bar in the line's height, as
 * `PageEyebrow` draws it) and, on a phone, the day's time beside the title.
 */
function HeadingSkeleton() {
  const t = useExtracted();

  return (
    <PageHeader className="[grid-area:head]">
      <PageHeaderContent className="w-full">
        <div className="flex h-4 items-center" data-slot="page-eyebrow">
          <Skeleton className="h-3 w-64 max-w-full rounded-sm" />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <PageTitle>{t("Today")}</PageTitle>
          <Skeleton className="h-4 w-20 rounded-md sm:hidden" />
        </div>
      </PageHeaderContent>
    </PageHeader>
  );
}

/**
 * Today's shape while it loads, the same frame Today draws (`TodayScreen`): the date line, the
 * title with the day's action beside it from `sm`, the day's segments, the queue's rows, and the
 * aside's week and preparation. Its words are Today's own ("Today", "This week"); only what the
 * day says (the date, the times, the blocks) waits as bars. Loading to loaded moves nothing.
 */
export function TodaySkeleton() {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={
        <>
          <WeekSkeleton />
          <PreparationSkeleton />
        </>
      }
      asideClassName={TODAY_ASIDE_CLASS}
      asideLabel={t("Your week")}
    >
      <Page aria-busy="true" data-slot="today-skeleton">
        <div className={TODAY_MAIN_CLASS}>
          <HeadingSkeleton />

          <div className="mt-4 [grid-area:action] sm:mt-0 sm:self-end">
            <ButtonSkeleton className="w-full sm:w-44" size="lg">
              {t("Continue session")}
            </ButtonSkeleton>
          </div>

          <div className="mt-5 flex flex-col [grid-area:session]">
            <Skeleton className="h-1 w-full rounded-[2px]" />
            <span className="mt-2 hidden justify-between sm:flex">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </span>
            <div className="mt-3 flex flex-col">
              {Array.from({ length: QUEUE_ROWS }, (_, row) => (
                <RowSkeleton key={row} />
              ))}
            </div>
          </div>
        </div>
      </Page>
    </PageWithAside>
  );
}
