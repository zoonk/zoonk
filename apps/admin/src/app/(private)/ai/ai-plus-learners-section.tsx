import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { STAT_TILES_CLASS, StatTile } from "@/components/stat-tile";
import { type PlusBilling, listPlusLearnerCosts } from "@/data/ai/list-plus-learner-costs";
import { formatDollars, formatUsd } from "@/lib/ai-format";
import { TableCell } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { CpuIcon, CrownIcon, TrendingUpIcon, TriangleAlertIcon } from "lucide-react";

type PlusLearners = Awaited<ReturnType<typeof listPlusLearnerCosts>>;
type PlusLearner = PlusLearners["learners"][number];

const PLAN_LABELS: Record<PlusBilling, string> = {
  granted: "Given by Zoonk",
  monthly: "Monthly",
  trial: "Trial",
  yearly: "Yearly",
};

const PLAN_ORDER: PlusBilling[] = ["monthly", "yearly", "trial", "granted"];

const LEARNER_ROWS = 50;

const PRICE_HELP =
  "AI cost this month above what the learner's plan pays a month: Stripe's list price in US dollars, a yearly plan's divided by 12, before store fees and local prices. Trials and Plus granted by support pay nothing, so they're left out.";

const planColumns: AdminTableColumn[] = [
  { label: "Plan" },
  { align: "right", label: "Learners" },
  { align: "right", label: "Pays a month" },
  { align: "right", label: "Cost" },
  { align: "right", label: "Average" },
  { align: "right", label: "Most" },
  { align: "right", label: "Cost more" },
];

const learnerColumns: AdminTableColumn[] = [
  { label: "Learner", twoLines: true },
  { label: "Plan", size: "wide" },
  { label: "Goals", size: "long" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
  { align: "right", label: "Pays a month" },
];

function isPaying(learner: PlusLearner): boolean {
  return learner.billing === "monthly" || learner.billing === "yearly";
}

function isAbovePlan(learner: PlusLearner): boolean {
  return isPaying(learner) && learner.paysUsd !== null && learner.costUsd > learner.paysUsd;
}

function sumCost(learners: readonly PlusLearner[]): number {
  return learners.reduce((total, learner) => total + learner.costUsd, 0);
}

function formatPays(paysUsd: number | null, billing: PlusBilling): string {
  if (billing === "trial" || billing === "granted") {
    return formatUsd(0);
  }

  return paysUsd === null ? "—" : formatUsd(paysUsd);
}

function Summary({ learners, prices }: Pick<PlusLearners, "learners" | "prices">) {
  const paying = learners.filter((learner) => isPaying(learner));
  const total = sumCost(learners);
  const [most] = learners;

  const above = learners.filter((learner) => isAbovePlan(learner)).length;

  return (
    <div className={STAT_TILES_CLASS}>
      <StatTile
        detail={`${paying.length.toLocaleString("en")} paying`}
        icon={<CrownIcon />}
        title="Plus learners"
        value={learners.length.toLocaleString("en")}
      />
      <StatTile
        detail={`${formatUsd(learners.length > 0 ? total / learners.length : 0)} a learner on average`}
        icon={<CpuIcon />}
        title="Cost this month"
        value={formatDollars(total)}
      />
      <StatTile
        detail={
          prices
            ? `of ${paying.length.toLocaleString("en")} paying`
            : "Stripe's prices couldn't be read"
        }
        help={PRICE_HELP}
        icon={<TriangleAlertIcon />}
        title="Cost more than they pay"
        tone={prices && above > 0 ? "danger" : "neutral"}
        value={prices ? above.toLocaleString("en") : "—"}
      />
      <StatTile
        detail={most?.user?.email ?? "Nobody yet"}
        icon={<TrendingUpIcon />}
        title="Most expensive"
        value={formatUsd(most?.costUsd ?? 0)}
      />
    </div>
  );
}

function PlanRow({
  billing,
  learners,
  paysUsd,
}: {
  billing: PlusBilling;
  learners: PlusLearner[];
  paysUsd: number | null;
}) {
  const total = sumCost(learners);
  const [first] = learners;

  return (
    <AdminTableRow>
      <TableCell className="text-foreground font-medium">{PLAN_LABELS[billing]}</TableCell>
      <TableCell numeric>{learners.length.toLocaleString()}</TableCell>
      <TableCell numeric>{formatPays(paysUsd, billing)}</TableCell>
      <TableCell numeric className="font-medium">
        {formatUsd(total)}
      </TableCell>
      <TableCell numeric>{formatUsd(total / Math.max(learners.length, 1))}</TableCell>
      <TableCell numeric>{formatUsd(first?.costUsd ?? 0)}</TableCell>
      <TableCell numeric>
        {billing === "trial" || billing === "granted"
          ? "—"
          : learners.filter((learner) => isAbovePlan(learner)).length.toLocaleString()}
      </TableCell>
    </AdminTableRow>
  );
}

function ByPlan({ learners, prices }: Pick<PlusLearners, "learners" | "prices">) {
  const plans = PLAN_ORDER.map((billing) => ({
    billing,
    learners: learners.filter((learner) => learner.billing === billing),
  })).filter((plan) => plan.learners.length > 0);

  return (
    <AdminTableColumns
      columns={planColumns}
      emptyLabel="Nobody has Plus."
      isEmpty={plans.length === 0}
    >
      {plans.map((plan) => (
        <PlanRow
          billing={plan.billing}
          key={plan.billing}
          learners={plan.learners}
          paysUsd={prices?.[plan.billing] ?? null}
        />
      ))}
    </AdminTableColumns>
  );
}

function LearnerGoals({ goals }: { goals: PlusLearner["goals"] }) {
  if (goals.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {goals.map((goal) => (
        <li className="flex items-baseline justify-between gap-3" key={goal.id}>
          <span className="truncate">{goal.title}</span>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatUsd(goal.costUsd)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LearnerRow({ learner }: { learner: PlusLearner }) {
  return (
    <AdminTableRow>
      <AdminUserCell user={learner.user} userId={learner.id} />
      <TableCell>{PLAN_LABELS[learner.billing]}</TableCell>
      <TableCell>
        <LearnerGoals goals={learner.goals} />
      </TableCell>
      <TableCell numeric>{learner.calls.toLocaleString()}</TableCell>
      <TableCell
        className={cn("font-medium", isAbovePlan(learner) && "text-destructive-text")}
        numeric
      >
        {formatUsd(learner.costUsd)}
      </TableCell>
      <TableCell numeric>{formatPays(learner.paysUsd, learner.billing)}</TableCell>
    </AdminTableRow>
  );
}

export async function AiPlusLearnersSection() {
  const { learners, prices, since } = await listPlusLearnerCosts();
  const spenders = learners.filter((learner) => learner.calls > 0).slice(0, LEARNER_ROWS);

  const sinceLabel = since.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <>
      <Summary learners={learners} prices={prices} />

      <AdminSection
        description={`Everyone with Plus now. AI calls since ${sinceLabel}, with the shared lessons they caused.`}
        title="By plan"
      >
        <ByPlan learners={learners} prices={prices} />
      </AdminSection>

      <AdminSection
        description="Who made AI calls this month, most expensive first. A cost in red is more than the plan pays."
        title="By learner"
      >
        <AdminTableColumns
          columns={learnerColumns}
          emptyLabel="No Plus learner made an AI call this month."
          isEmpty={spenders.length === 0}
        >
          {spenders.map((learner) => (
            <LearnerRow key={learner.id} learner={learner} />
          ))}
        </AdminTableColumns>
      </AdminSection>
    </>
  );
}
