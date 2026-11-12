"use client";

import { type LeaderboardEntry } from "@/lib/leaderboard";
import { type BattleLeaderboardEntry } from "@/lib/types";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { BattleLeaderboard } from "./battle-leaderboard";
import { Leaderboard } from "./leaderboard";

const LEADERBOARD_SKELETON_ROWS = ["leaderboard-row-1", "leaderboard-row-2", "leaderboard-row-3"];

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
  entries,
  battleEntries,
  battleJudgeCost,
  supportsJudgeMode,
  totalRuns,
}: {
  taskId: string;
  entries: LeaderboardEntry[];
  battleEntries: BattleLeaderboardEntry[];
  battleJudgeCost: number;
  supportsJudgeMode: boolean;
  totalRuns: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRegularResults = entries.length > 0;
  const hasBattleResults = battleEntries.length > 0;
  const currentTab = searchParams.get("tab") ?? (hasBattleResults ? "battle" : "regular");

  if (!supportsJudgeMode) {
    return hasRegularResults ? (
      <Leaderboard entries={entries} taskId={taskId} totalRuns={totalRuns} />
    ) : null;
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
        <TabsTrigger value="battle">Battles</TabsTrigger>
        <TabsTrigger value="regular">Scores</TabsTrigger>
      </TabsList>

      <TabsContent value="battle">
        <BattleLeaderboard entries={battleEntries} judgeCost={battleJudgeCost} taskId={taskId} />
      </TabsContent>

      <TabsContent value="regular">
        <Leaderboard entries={entries} taskId={taskId} totalRuns={totalRuns} />
      </TabsContent>
    </Tabs>
  );
}
