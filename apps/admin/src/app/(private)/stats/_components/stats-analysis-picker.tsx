"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import { STATS_ANALYSIS_GROUPS, type StatsAnalysisView } from "../_utils/stats-analysis";

/**
 * Builds the destination locally so switching analysis always keeps the useful
 * date context, including while a view temporarily hides period controls.
 */
function buildAnalysisHref({
  periodQuery,
  view,
}: {
  periodQuery: string;
  view: StatsAnalysisView;
}): `${StatsAnalysisView["path"]}?${string}` {
  const searchParams = new URLSearchParams(periodQuery);
  searchParams.set("view", view.id);

  return `${view.path}?${searchParams.toString()}`;
}

/**
 * The picker turns the old three-page dashboard into one focused explorer:
 * only one metric is visible, while every existing analysis remains one click
 * away in a grouped, keyboard-accessible menu.
 */
export function StatsAnalysisPicker({
  periodQuery,
  selectedView,
}: {
  periodQuery: string;
  selectedView: StatsAnalysisView;
}) {
  const router = useRouter();

  return (
    <DropdownMenu key={selectedView.id}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Choose analysis. Current: ${selectedView.label}`}
            className="-ml-2 h-auto w-full max-w-full justify-start border-transparent px-2 py-1 text-left text-2xl font-semibold tracking-tight sm:w-auto sm:text-3xl"
            variant="ghost"
          />
        }
      >
        <span className="min-w-0 truncate">{selectedView.label}</span>
        <ChevronDownIcon aria-hidden className="text-muted-foreground size-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-[min(70vh,42rem)] w-[min(22rem,calc(100vw-2rem))]">
        {STATS_ANALYSIS_GROUPS.map((group, groupIndex) => (
          <Fragment key={group.label}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="tracking-wider uppercase">
                {group.label}
              </DropdownMenuLabel>
              {group.views.map((view) => (
                <DropdownMenuItem
                  className="justify-between"
                  key={view.id}
                  onClick={() => router.push(buildAnalysisHref({ periodQuery, view }))}
                >
                  <span>{view.label}</span>
                  {view.id === selectedView.id ? (
                    <CheckIcon aria-hidden className="text-foreground" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
