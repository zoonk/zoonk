"use client";

import { Badge } from "@zoonk/ui/components/badge";

export function RankingItem({
  anonymousId,
  reasoning,
  score,
  testCaseId,
}: {
  anonymousId: string;
  reasoning: string;
  score: number;
  testCaseId: string;
}) {
  return (
    <div className="bg-muted rounded-lg p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{testCaseId}</span>
          <Badge variant="outline">{anonymousId}</Badge>
        </div>
        <Badge>{score.toFixed(1)}</Badge>
      </div>
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">{reasoning}</p>
    </div>
  );
}
