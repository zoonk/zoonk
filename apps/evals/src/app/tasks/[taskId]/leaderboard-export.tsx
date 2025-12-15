"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Download } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/leaderboard";

type LeaderboardExportProps = {
  taskId: string;
  entries: LeaderboardEntry[];
};

export function LeaderboardExport({ taskId, entries }: LeaderboardExportProps) {
  function exportAsMarkdown(anonymous: boolean) {
    let markdown = "";

    if (anonymous) {
      // Export with position, average score, duration, and cost only
      markdown = "| Position | Avg Score | Avg Duration | Cost |\n";
      markdown += "|----------|-----------|--------------|------|\n";
      for (const [index, entry] of entries.entries()) {
        markdown += `| ${index + 1} | ${entry.averageScore.toFixed(2)} | ${entry.averageDuration.toFixed(2)}s | $${entry.totalCost.toFixed(2)} |\n`;
      }
    } else {
      // Export all data
      markdown = "| Model | Provider | Avg Score | Avg Duration | Cost |\n";
      markdown += "|-------|----------|-----------|--------------|------|\n";
      for (const entry of entries) {
        markdown += `| ${entry.modelName} | ${entry.provider} | ${entry.averageScore.toFixed(2)} | ${entry.averageDuration.toFixed(2)}s | $${entry.totalCost.toFixed(2)} |\n`;
      }
    }

    // Create a blob and download it
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${taskId}${anonymous ? "-anonymous" : ""}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        <Download className="size-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportAsMarkdown(false)}>
          Export All Data
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsMarkdown(true)}>
          Export Anonymous Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
