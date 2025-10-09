import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelEvalResult } from "./course-suggestions-eval";
import { getModelDisplayName } from "./models";

const EVALS_FILE = join(process.cwd(), "ai", "course-suggestions-evals.md");
const TWO_DECIMALS = 2;
const MIN_TABLE_COLUMNS = 4;

interface LeaderboardEntry {
  model: string;
  average: number;
  median: number;
  avgCost: number;
}

/**
 * Parse a table row into a leaderboard entry.
 */
function parseTableRow(line: string): LeaderboardEntry | null {
  const parts = line
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p);

  if (parts.length < MIN_TABLE_COLUMNS) {
    return null;
  }

  const [model, averageStr, medianStr, avgCostStr] = parts;
  const hasAllParts = Boolean(model && averageStr && medianStr && avgCostStr);

  if (!hasAllParts) {
    return null;
  }

  return {
    model: model ?? "",
    average: Number.parseFloat(averageStr ?? "0"),
    median: Number.parseFloat(medianStr ?? "0"),
    avgCost: Number.parseFloat((avgCostStr ?? "0").replace("$", "")),
  };
}

/**
 * Parse existing leaderboard from markdown file.
 */
async function parseExistingLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const content = await readFile(EVALS_FILE, "utf-8");
    const lines = content.split("\n");
    const entries: LeaderboardEntry[] = [];

    const tableHeaderIndex = lines.findIndex(
      (line) => line.startsWith("|") && line.includes("Model"),
    );

    if (tableHeaderIndex === -1) {
      return entries;
    }

    // Process lines after the header
    for (let i = tableHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      const isTableRow = line.startsWith("|") && !line.includes("---");
      if (isTableRow) {
        const entry = parseTableRow(line);
        if (entry) {
          entries.push(entry);
        }
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Update leaderboard with new evaluation result.
 */
export async function updateLeaderboard(
  result: ModelEvalResult,
): Promise<void> {
  const entries = await parseExistingLeaderboard();

  const modelDisplayName = getModelDisplayName(result.model);

  // Remove existing entry for this model
  const filteredEntries = entries.filter(
    (entry) => entry.model !== modelDisplayName,
  );

  // Add new entry
  filteredEntries.push({
    model: modelDisplayName,
    average: result.averageScore,
    median: result.medianScore,
    avgCost: result.avgCostPer100,
  });

  // Sort by average score (descending)
  const sorted = filteredEntries.sort((a, b) => b.average - a.average);

  // Generate markdown table
  const tableRows = sorted.map(
    (entry) =>
      `| ${entry.model} | ${entry.average.toFixed(TWO_DECIMALS)} | ${entry.median.toFixed(TWO_DECIMALS)} | $${entry.avgCost.toFixed(TWO_DECIMALS)} |`,
  );

  const markdown = `## Suggest Courses Evals

### Notes

- Average and Median values go from 0 to 10, where 10 is the best.
- Avg. Cost is the average cost per 100 calls in USD.

### Leaderboard

| Model | Average | Median | Avg. Cost |
|-------|---------|--------|-----------|
${tableRows.join("\n")}
`;

  await writeFile(EVALS_FILE, markdown);
}
