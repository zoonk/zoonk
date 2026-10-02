import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { LanguageToday } from "@zoonk/learn/language/today";

/**
 * What Today adds for a language goal: the current situation, a new "I can", a noticed pattern
 * and the words to say again. Any other goal renders nothing, so Today streams it on its own.
 */
export async function LanguageTodaySection({ goalId }: { goalId: string }) {
  const result = await getLanguageTodayView({ goalId });

  if (result.status !== "ready") {
    return null;
  }

  const { currentUnit, pattern } = result.today;

  return (
    <LanguageToday
      hrefs={{
        canDo: "/progress",
        pattern: pattern ? `/pattern/${pattern.id}` : null,
        pronunciation: `/pronunciation?goal=${goalId}`,
        unit: currentUnit ? `/content/units/${currentUnit.chapterId}` : null,
      }}
      today={result.today}
    />
  );
}
