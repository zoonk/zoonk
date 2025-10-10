import { setRequestLocale } from "next-intl/server";
import { EVAL_MODELS } from "@/ai/evals/models";
import { EvalRunner } from "./eval-runner";

const canRunEvals = process.env.RUN_EVALS === "true";
const title = "Course Suggestions Evals";
const description =
  "Evaluate different AI models for generating course suggestions.";
const leaderboardTitle = "Leaderboard";
const noResults = "No evaluation results yet.";

async function LeaderboardContent() {
  try {
    const { default: Leaderboard } = await import(
      "@/ai/evals/course-suggestions-evals.mdx"
    );
    return <Leaderboard />;
  } catch {
    return <p>{noResults}</p>;
  }
}

export default async function EvalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!canRunEvals) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-bold text-3xl">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>

      <EvalRunner models={EVAL_MODELS} />

      <div className="rounded-lg border p-6">
        <h2 className="mb-4 font-semibold text-xl">{leaderboardTitle}</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <LeaderboardContent />
        </div>
      </div>
    </div>
  );
}
