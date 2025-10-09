import { setRequestLocale } from "next-intl/server";
import { EvalRunner } from "./eval-runner";
import { LeaderboardDisplay } from "./leaderboard-display";

const isProduction = process.env.NODE_ENV === "production";
const pageTitle = "Course Suggestions Evals";
const pageDescription =
  "Evaluate different AI models for generating course suggestions.";

export default async function EvalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-bold text-3xl">{pageTitle}</h1>
        <p className="mt-2 text-muted-foreground">{pageDescription}</p>
      </div>

      {!isProduction && <EvalRunner />}

      <LeaderboardDisplay />
    </div>
  );
}
