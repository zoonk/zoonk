import { getScoreHistory } from "@/data/progress/get-score-history";
import { getSession } from "@/data/users/get-session";
import { getLocale } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ScoreChart, ScoreChartSkeleton } from "./score-chart";
import { ScoreExplanation, ScoreExplanationSkeleton } from "./score-explanation";
import { ScoreStats, ScoreStatsSkeleton } from "./score-stats";

/** Presents every Score surface as one coherent rolling 90-day view. */
export async function ScoreContent() {
  const locale = await getLocale();

  const [history, session] = await Promise.all([getScoreHistory({ locale }), getSession()]);

  const isAuthenticated = Boolean(session);

  if (!(history && isAuthenticated)) {
    return (
      <ProgressEmptyState isAuthenticated={isAuthenticated}>
        <ScoreExplanation />
      </ProgressEmptyState>
    );
  }

  return (
    <ProgressContent>
      <ScoreStats performance={history} />
      <ScoreChart dataPoints={history.dataPoints} performance={history} />
      <ScoreExplanation />
    </ProgressContent>
  );
}

/** Mirrors every final Score section while the private rolling data streams. */
export function ScoreContentSkeleton() {
  return (
    <ProgressContent>
      <ScoreStatsSkeleton />
      <ScoreChartSkeleton />
      <ScoreExplanationSkeleton />
    </ProgressContent>
  );
}
