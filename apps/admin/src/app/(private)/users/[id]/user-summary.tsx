import { STAT_TILES_CLASS, StatTile, StatTileSkeleton } from "@/components/stat-tile";
import { getUser } from "@/data/users/get-user";
import { getUserLearningTotals } from "@/data/users/get-user-learning-stats";
import { capitalize, formatCount } from "@/lib/format";
import { formatDuration } from "@/lib/format-duration";
import { Meter, MeterFill } from "@zoonk/learn/meter";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { BookOpenIcon, BrainIcon, ClockIcon, ZapIcon } from "lucide-react";

/** Energy runs from 0 to 100, and the learner's app shows it as a percent. */
const MAX_ENERGY = 100;

/** The learner's own headline numbers, with the marks and colors their app shows them in. */
export async function UserSummary({ userId }: { userId: string }) {
  "use cache: private";

  const [user, totals] = await Promise.all([getUser(userId), getUserLearningTotals(userId)]);

  if (!user) {
    return null;
  }

  const brainPower = Number(user.progress?.totalBrainPower ?? 0);
  const energy = user.progress?.currentEnergy ?? 0;
  const belt = calculateBeltLevel(brainPower);
  const beltName = `${capitalize(belt.color)} belt`;

  return (
    <div className={STAT_TILES_CLASS}>
      <StatTile
        detail={
          <span className="flex items-center gap-1.5">
            <BeltIndicator color={belt.color} label={beltName} size="sm" />
            {beltName}, level {belt.level}
          </span>
        }
        icon={<BrainIcon />}
        title="Brain Power"
        tone="brain"
        value={brainPower.toLocaleString("en")}
      />

      <StatTile
        detail={
          <Meter className="mt-1">
            <MeterFill className="bg-energy" share={energy / MAX_ENERGY} />
          </Meter>
        }
        icon={<ZapIcon />}
        title="Energy"
        tone="energy"
        value={`${Math.round(energy)}%`}
      />

      <StatTile
        detail={`On ${formatCount(totals.learningDays, "day")}`}
        icon={<ClockIcon />}
        title="Study time"
        value={formatDuration(totals.totalLearningSeconds)}
      />

      <StatTile
        icon={<BookOpenIcon />}
        title="Lessons completed"
        value={totals.completedLessons.toLocaleString("en")}
      />
    </div>
  );
}

export function UserSummarySkeleton() {
  return (
    <div className={STAT_TILES_CLASS}>
      {Array.from({ length: 4 }, (_, index) => (
        <StatTileSkeleton key={index} />
      ))}
    </div>
  );
}
