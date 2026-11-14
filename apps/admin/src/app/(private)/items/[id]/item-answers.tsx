import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { StatTile } from "@/components/stat-tile";
import { countItemMistakes } from "@/data/items/get-item";
import {
  getItemAccuracy,
  getItemAnswerStats,
  readItemAnswerStats,
} from "@/data/items/get-item-answer-stats";
import { formatCount, formatPercent } from "@/lib/format";
import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import { CircleCheckIcon, MessageSquareIcon } from "lucide-react";

const PERCENT = 100;

/** How learners did on it. Accounts left out of analytics aren't counted. */
export async function ItemAnswers({ itemId }: { itemId: string }) {
  "use cache: private";

  const [answerStats, mistakes] = await Promise.all([
    getItemAnswerStats([itemId]),
    countItemMistakes(itemId),
  ]);

  const stats = readItemAnswerStats(answerStats, itemId);
  const accuracy = getItemAccuracy(stats);

  return (
    <AdminSection title="Answers">
      {stats.attempts === 0 ? (
        <AdminSectionEmpty>No learner has answered it yet.</AdminSectionEmpty>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            detail={`${formatCount(mistakes.open, "mistake")} still open`}
            icon={<MessageSquareIcon />}
            title="Answers"
            value={stats.attempts.toLocaleString("en")}
          />
          <StatTile
            detail={
              <Meter className="mt-1">
                <MeterFill share={(accuracy ?? 0) / PERCENT} />
              </Meter>
            }
            icon={<CircleCheckIcon />}
            title="Right"
            tone="success"
            value={formatPercent(accuracy)}
          />
        </div>
      )}
    </AdminSection>
  );
}
