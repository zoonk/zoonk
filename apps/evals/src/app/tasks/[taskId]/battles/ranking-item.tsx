"use client";

import { type CategoryScore } from "@/lib/types";
import { Badge } from "@zoonk/ui/components/badge";

export function RankingItem({
  anonymousId,
  categoryScores,
  reasoning,
  score,
  testCaseId,
}: {
  anonymousId: string;
  categoryScores?: CategoryScore[];
  reasoning: string;
  score: number;
  testCaseId: string;
}) {
  return (
    <div className="bg-muted rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{testCaseId}</span>
          <Badge variant="outline">{anonymousId}</Badge>
        </div>
        <span className="text-sm font-semibold tabular-nums">{score.toFixed(1)}</span>
      </div>
      {categoryScores && categoryScores.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
          {categoryScores.map((category) => (
            <li key={category.categoryId}>
              {category.label}: {category.score.toFixed(1)}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground max-w-column text-sm whitespace-pre-wrap">{reasoning}</p>
    </div>
  );
}
