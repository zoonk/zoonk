"use client";

import { type BattleLeaderboardEntry, type TaskEvalResults } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { BattleLeaderboard } from "./battle-leaderboard";
import { Leaderboard } from "./leaderboard";

type LeaderboardTabsProps = {
  taskId: string;
  results: TaskEvalResults[];
  battleEntries: BattleLeaderboardEntry[];
};

export function LeaderboardTabs({ taskId, results, battleEntries }: LeaderboardTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "battle";

  const hasRegularResults = results.length > 0;
  const hasBattleResults = battleEntries.length > 0;

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
