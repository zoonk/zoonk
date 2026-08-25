"use client";

import { type LeaderboardEntry } from "@/lib/leaderboard";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { downloadFile } from "@zoonk/utils/download";
import { Download } from "lucide-react";

export function LeaderboardExport({
  taskId,
  entries,
}: {
  taskId: string;
  entries: LeaderboardEntry[];
}) {
  const categories = entries[0]?.categoryScores ?? [];
  const categoryHeaders = categories.map((category) => category.label).join(" | ");
  const anonymousDivider = ["---", "---", ...categories.map(() => "---"), "---", "---"].join(" | ");

  const fullDivider = [
    "---",
    "---",
    "---",
    "---",
    ...categories.map(() => "---"),
    "---",
    "---",
  ].join(" | ");

  function formatCategoryScores(entry: LeaderboardEntry): string {
    return categories
      .map((category) => {
        const score = entry.categoryScores.find(
          (entryScore) => entryScore.categoryId === category.categoryId,
        );

        return score?.score.toFixed(2) ?? "—";
      })
      .join(" | ");
  }

  function exportAsMarkdown(anonymous: boolean) {
    let markdown = "";

    if (anonymous) {
      // Export with position, average score, duration, and cost only
      markdown = `| Position | Avg Score | ${categoryHeaders ? `${categoryHeaders} | ` : ""}Avg Duration | Cost |\n`;
      markdown += `| ${anonymousDivider} |\n`;

      for (const [index, entry] of entries.entries()) {
        const categoryScores = formatCategoryScores(entry);
        markdown += `| ${index + 1} | ${entry.averageScore.toFixed(2)} | ${categoryScores ? `${categoryScores} | ` : ""}${entry.averageDuration.toFixed(2)}s | $${entry.totalCost.toFixed(2)} |\n`;
      }
    } else {
      // Export all data
      markdown = `| Model | Provider | Reasoning | Avg Score | ${categoryHeaders ? `${categoryHeaders} | ` : ""}Avg Duration | Cost |\n`;
      markdown += `| ${fullDivider} |\n`;

      for (const entry of entries) {
        const categoryScores = formatCategoryScores(entry);
        markdown += `| ${entry.modelName} | ${entry.provider} | ${entry.reasoning} | ${entry.averageScore.toFixed(2)} | ${categoryScores ? `${categoryScores} | ` : ""}${entry.averageDuration.toFixed(2)}s | $${entry.totalCost.toFixed(2)} |\n`;
      }
    }

    downloadFile(
      markdown,
      `leaderboard-${taskId}${anonymous ? "-anonymous" : ""}.md`,
      "text/markdown",
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        <Download className="size-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportAsMarkdown(false)}>Export All Data</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsMarkdown(true)}>
          Export Anonymous Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
