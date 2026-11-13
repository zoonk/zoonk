"use client";

import { REQUIRED_LANGUAGES, formatLanguageResults } from "@/lib/case-languages";
import {
  HISTORICAL_ATTEMPTS_NOTE,
  formatFailureCounts,
  formatKeyFlaws,
  getCaseHref,
} from "@/lib/eval-summary";
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

function getMetricHeaders(showBudget: boolean): string[] {
  return [
    "Attempted (recorded)",
    "Generated",
    "Scored outputs",
    "Generation failures",
    "Judge-flagged key flaws",
    "Case links",
    "Accuracy",
    ...REQUIRED_LANGUAGES.map((language) => language.toUpperCase()),
    "p50",
    "p95",
    "Cost / 1k runs",
    ...(showBudget ? ["Latency budget"] : []),
  ];
}

function formatMetrics({
  entry,
  showBudget,
  taskId,
  anonymous,
}: {
  entry: LeaderboardEntry;
  showBudget: boolean;
  taskId: string;
  anonymous: boolean;
}) {
  return [
    entry.summary.attempted,
    entry.summary.generated,
    entry.summary.scored,
    formatFailureCounts(entry.summary),
    formatKeyFlaws(entry.summary),
    entry.summary.caseIds.attempted
      .map(
        (caseId) =>
          `[${caseId}](${anonymous ? `#case-${encodeURIComponent(caseId)}` : getCaseHref({ caseId, modelId: entry.modelId, taskId })})`,
      )
      .join(", ") || "—",
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
  const categories = entries.find((entry) => entry.categoryScores.length > 0)?.categoryScores ?? [];
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
      markdown = `${HISTORICAL_ATTEMPTS_NOTE}\n\n| Position | Avg score (scored outputs) | ${categoryHeaders ? `${categoryHeaders} | ` : ""}${metricHeaders.join(" | ")} |\n`;
      markdown += `| ${anonymousDivider} |\n`;

      for (const [index, entry] of entries.entries()) {
        const categoryScores = formatCategoryScores(entry);
        markdown += `| ${index + 1} | ${entry.averageScore?.toFixed(2) ?? "Unscored"} | ${categoryScores ? `${categoryScores} | ` : ""}${formatMetrics({ anonymous, entry, showBudget, taskId })} |\n`;
      }
    } else {
      markdown = `${HISTORICAL_ATTEMPTS_NOTE}\n\n| Model | Provider | Reasoning | Avg score (scored outputs) | ${categoryHeaders ? `${categoryHeaders} | ` : ""}${metricHeaders.join(" | ")} |\n`;
      markdown += `| ${fullDivider} |\n`;

      for (const entry of entries) {
        const categoryScores = formatCategoryScores(entry);
        markdown += `| ${entry.modelName} | ${entry.provider} | ${entry.reasoning} | ${entry.averageScore?.toFixed(2) ?? "Unscored"} | ${categoryScores ? `${categoryScores} | ` : ""}${formatMetrics({ anonymous, entry, showBudget, taskId })} |\n`;
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
      <DropdownMenuTrigger render={<Button icon={<Download />} size="sm" variant="outline" />}>
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportAsMarkdown(false)}>
          With model names
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsMarkdown(true)}>
          Without model names
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
