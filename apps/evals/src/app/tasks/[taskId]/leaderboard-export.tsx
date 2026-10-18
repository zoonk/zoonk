"use client";

import { REQUIRED_LANGUAGES, formatLanguageResults } from "@/lib/case-languages";
import { formatDollars, formatLatencyVerdict, formatPercent, formatSeconds } from "@/lib/format";
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

/** The budget column only shows for tasks that have a latency budget. */
function getMetricHeaders(showBudget: boolean): string[] {
  return [
    "Accuracy",
    ...REQUIRED_LANGUAGES.map((language) => language.toUpperCase()),
    "p50",
    "p95",
    "Cost / 1k runs",
    ...(showBudget ? ["Latency budget"] : []),
  ];
}

function formatMetrics({ entry, showBudget }: { entry: LeaderboardEntry; showBudget: boolean }) {
  return [
    entry.accuracy === null ? "—" : formatPercent(entry.accuracy),
    ...formatLanguageResults(entry.languages).map((result) => result.text),
    formatSeconds(entry.latencyP50),
    formatSeconds(entry.latencyP95),
    formatDollars(entry.costPer1000Runs),
    ...(showBudget ? [formatLatencyVerdict(entry.meetsLatencyBudget)] : []),
  ].join(" | ");
}

export function LeaderboardExport({
  taskId,
  entries,
}: {
  taskId: string;
  entries: LeaderboardEntry[];
}) {
  const categories = entries[0]?.categoryScores ?? [];
  const categoryHeaders = categories.map((category) => category.label).join(" | ");
  const showBudget = entries.some((entry) => entry.meetsLatencyBudget !== null);
  const metricHeaders = getMetricHeaders(showBudget);
  const metricDividers = metricHeaders.map(() => "---");

  const anonymousDivider = ["---", "---", ...categories.map(() => "---"), ...metricDividers].join(
    " | ",
  );

  const fullDivider = [
    "---",
    "---",
    "---",
    "---",
    ...categories.map(() => "---"),
    ...metricDividers,
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
      markdown = `| Position | Avg Score | ${categoryHeaders ? `${categoryHeaders} | ` : ""}${metricHeaders.join(" | ")} |\n`;
      markdown += `| ${anonymousDivider} |\n`;

      for (const [index, entry] of entries.entries()) {
        const categoryScores = formatCategoryScores(entry);
        markdown += `| ${index + 1} | ${entry.averageScore.toFixed(2)} | ${categoryScores ? `${categoryScores} | ` : ""}${formatMetrics({ entry, showBudget })} |\n`;
      }
    } else {
      // Export all data
      markdown = `| Model | Provider | Reasoning | Avg Score | ${categoryHeaders ? `${categoryHeaders} | ` : ""}${metricHeaders.join(" | ")} |\n`;
      markdown += `| ${fullDivider} |\n`;

      for (const entry of entries) {
        const categoryScores = formatCategoryScores(entry);
        markdown += `| ${entry.modelName} | ${entry.provider} | ${entry.reasoning} | ${entry.averageScore.toFixed(2)} | ${categoryScores ? `${categoryScores} | ` : ""}${formatMetrics({ entry, showBudget })} |\n`;
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
