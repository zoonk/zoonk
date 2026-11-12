import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminToolbar } from "@/components/admin-page";
import { AdminSection } from "@/components/admin-section";
import { Stats } from "@/components/stats";
import { AiMockShell } from "../../_mock/ai-shell";
import { MockMore, MockTable } from "../../_mock/parts";
import { AiDailySpendChart } from "../ai-daily-spend-chart";

const SPEND: Record<string, number> = {
  "Oct 13": 2.55,
  "Oct 14": 2.78,
  "Oct 15": 0.36,
  "Oct 17": 0.32,
  "Oct 18": 0.49,
  "Oct 24": 0.29,
  "Oct 25": 1.8,
  "Oct 26": 2.29,
};

const DAYS = [
  ...Array.from({ length: 19 }, (_, index) => `Oct ${index + 13}`),
  ...Array.from({ length: 12 }, (_, index) => `Nov ${index + 1}`),
];

const POINTS = DAYS.map((label) => ({ costUsd: SPEND[label] ?? 0, label }));

const TASKS = [
  ["Lesson spec", "36", "$1.65", "$0.0458", "29.8s"],
  ["Lesson writer", "33", "$1.61", "$0.0488", "22.7s"],
  ["Course outline", "21", "$0.98", "$0.0469", "25.1s"],
  ["Lesson quality check", "27", "$0.86", "$0.0320", "13.8s"],
  ["Lesson image", "76", "$0.67", "$0.0089", "9.7s"],
  ["Placement items", "20", "$0.57", "$0.0284", "26.6s"],
  ["Image scene", "64", "$0.29", "$0.0045", "6.7s"],
  ["Skill graph", "3", "$0.19", "$0.0643", "32.9s"],
] as const;

export default function AiMockPage() {
  return (
    <AiMockShell current="spend" notice>
      <AdminToolbar>
        <AdminFilterNav
          label="Period"
          options={[
            { href: "#7", isActive: false, label: "7 days" },
            { href: "#30", isActive: true, label: "30 days" },
            { href: "#90", isActive: false, label: "90 days" },
          ]}
        />
        <span className="text-muted-foreground text-[0.8125rem]">
          Compared with the 30 days before
        </span>
      </AdminToolbar>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stats description="Up from $4.12" title="Spend" value="$7.57" />
        <Stats description="Up from 1,340" title="Calls" value="2,175" />
        <Stats description="Down from $0.0031" title="Cost per call" value="$0.0035" />
        <Stats description="1.4M of 6.3M input tokens" title="Read from cache" value="22%" />
      </div>

      <AiDailySpendChart points={POINTS} />

      <AdminSection
        action={
          <AdminFilterNav
            label="Spend by"
            options={[
              { href: "#task", isActive: true, label: "Task" },
              { href: "#model", isActive: false, label: "Model" },
              { href: "#goal", isActive: false, label: "Goal" },
              { href: "#learner", isActive: false, label: "Learner" },
            ]}
          />
        }
        title="Where it went"
      >
        <MockTable
          columns={[
            { label: "Task" },
            { align: "right", label: "Calls" },
            { align: "right", label: "Cost" },
            { align: "right", label: "Per call" },
            { align: "right", label: "Typical time" },
          ]}
          rows={TASKS.map(([task, ...cells]) => ({
            cells: [
              <span className="text-foreground font-medium" key={task}>
                {task}
              </span>,
              ...cells,
            ],
            key: task,
          }))}
        />
        <MockMore>Show all 54 tasks</MockMore>
      </AdminSection>
    </AiMockShell>
  );
}
