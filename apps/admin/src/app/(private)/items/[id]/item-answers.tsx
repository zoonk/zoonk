import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { countItemMistakes } from "@/data/items/get-item";
import {
  getItemAccuracy,
  getItemAnswerStats,
  readItemAnswerStats,
} from "@/data/items/get-item-answer-stats";
import { formatPercent } from "@/lib/format";

/** How learners answer the item, the mistakes it caused. */
export async function ItemAnswers({ itemId }: { itemId: string }) {
  "use cache: private";

  const [answerStats, mistakes] = await Promise.all([
    getItemAnswerStats([itemId]),
    countItemMistakes(itemId),
  ]);

  const stats = readItemAnswerStats(answerStats, itemId);

  return (
    <AdminSection
      description="From learners' answers, without accounts left out of analytics."
      title="Answers"
    >
      <dl className="divide-y">
        <DetailField label="Attempts">
          <span className="tabular-nums">{stats.attempts}</span>
        </DetailField>
        <DetailField label="Accuracy">{formatPercent(getItemAccuracy(stats))}</DetailField>
        <DetailField label="Open mistakes">
          <span className="tabular-nums">{mistakes.open}</span>
        </DetailField>
        <DetailField label="Fixed mistakes">
          <span className="tabular-nums">{mistakes.fixed}</span>
        </DetailField>
      </dl>
    </AdminSection>
  );
}
