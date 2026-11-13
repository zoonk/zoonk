"use client";

import { type LeaderboardEntry } from "@/lib/leaderboard";
import { type BattleLeaderboardEntry } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { BattleLeaderboard } from "./battle-leaderboard";
import { Leaderboard } from "./leaderboard";

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
      <TabsList className="-mx-2.5">
        <TabsTrigger value="battle">Judged side by side</TabsTrigger>
        <TabsTrigger value="regular">Scored one by one</TabsTrigger>
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
