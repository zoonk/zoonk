"use client";

import { type BattleLeaderboardEntry, type TaskEvalResults } from "@/lib/types";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { BattleLeaderboard } from "./battle-leaderboard";
import { Leaderboard } from "./leaderboard";

const LEADERBOARD_SKELETON_ROWS = ["leaderboard-row-1", "leaderboard-row-2", "leaderboard-row-3"];

/**
 * Uses neutral table-height rows because URL data decides whether this region
 * becomes Battle Mode tabs, a regular leaderboard, or no leaderboard at all.
 */
export function LeaderboardTabsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col divide-y">
      {LEADERBOARD_SKELETON_ROWS.map((rowId) => (
        <div className="flex h-12 items-center gap-6 px-2" key={rowId}>
          <Skeleton className="h-5 flex-1 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

export function LeaderboardTabs({
  taskId,
  results,
  battleEntries,
  supportsJudgeMode,
}: {
  taskId: string;
  results: TaskEvalResults[];
  battleEntries: BattleLeaderboardEntry[];
  supportsJudgeMode: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "battle";

  const hasRegularResults = results.length > 0;
  const hasBattleResults = battleEntries.length > 0;

  if (!supportsJudgeMode) {
    return hasRegularResults ? <Leaderboard results={results} taskId={taskId} /> : null;
  }

  if (!(hasRegularResults || hasBattleResults)) {
    return null;
  }

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs onValueChange={handleTabChange} value={currentTab}>
      <TabsList variant="line">
        <TabsTrigger value="battle">Battle Mode</TabsTrigger>
        <TabsTrigger value="regular">Regular Leaderboard</TabsTrigger>
      </TabsList>

      <TabsContent value="battle">
        <BattleLeaderboard entries={battleEntries} taskId={taskId} />
      </TabsContent>

      <TabsContent value="regular">
        <Leaderboard results={results} taskId={taskId} />
      </TabsContent>
    </Tabs>
  );
}
