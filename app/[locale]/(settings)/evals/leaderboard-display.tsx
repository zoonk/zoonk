import { readFile } from "node:fs/promises";
import { join } from "node:path";

const EVALS_FILE = join(process.cwd(), "ai", "course-suggestions-evals.md");

async function getLeaderboardContent(): Promise<string> {
  try {
    return await readFile(EVALS_FILE, "utf-8");
  } catch {
    return "No evaluation results yet.";
  }
}

export async function LeaderboardDisplay() {
  const content = await getLeaderboardContent();

  return (
    <div className="rounded-lg border p-6">
      <pre className="overflow-auto whitespace-pre-wrap font-mono text-sm">
        {content}
      </pre>
    </div>
  );
}
