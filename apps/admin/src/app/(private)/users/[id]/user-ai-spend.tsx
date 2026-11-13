import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AiTaskName } from "@/components/ai-task-name";
import { BarList } from "@/components/bar-list";
import { STAT_TILES_CLASS, StatTile } from "@/components/stat-tile";
import { getUserAiSpend } from "@/data/ai/get-user-ai-spend";
import { formatDollars, formatUsd } from "@/lib/ai-format";
import { sumOf } from "@zoonk/utils/number";
import { CpuIcon, HashIcon } from "lucide-react";

/** What this learner's own AI calls cost: the total, then the tasks it went to, most first. */
export async function UserAiSpend({ userId }: { userId: string }) {
  "use cache: private";

  const { days, tasks } = await getUserAiSpend(userId);
  const calls = sumOf(tasks.map((row) => row.calls));

  return (
    <AdminSection title={`AI spend, last ${days} days`}>
      {tasks.length === 0 ? (
        <AdminSectionEmpty>No AI calls.</AdminSectionEmpty>
      ) : (
        <>
          <div className={STAT_TILES_CLASS}>
            <StatTile
              icon={<CpuIcon />}
              title="Spend"
              value={formatDollars(sumOf(tasks.map((row) => row.costUsd)))}
            />
            <StatTile icon={<HashIcon />} title="Calls" value={calls.toLocaleString("en")} />
          </div>

          <BarList
            rows={tasks.map((row) => ({
              display: formatUsd(row.costUsd),
              key: row.task,
              name: <AiTaskName task={row.task} />,
              value: row.costUsd,
            }))}
          />
        </>
      )}
    </AdminSection>
  );
}
