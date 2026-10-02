import { listGoalChangeNotices } from "@zoonk/core/library/sources/notices";
import { TodayChangeNotice } from "@zoonk/learn/today/change-notice";

/**
 * The newest change to a source the goal is built on (its exam notice, a law, a tool's docs), as
 * one line on Today. Nothing renders without one.
 */
export async function SourceChangeSection({ goalId }: { goalId: string }) {
  const result = await listGoalChangeNotices({ goalId });
  const latest = result.status === "ready" ? result.notices[0] : undefined;

  if (!latest) {
    return null;
  }

  return <TodayChangeNotice className="mb-6" message={latest.message} />;
}
