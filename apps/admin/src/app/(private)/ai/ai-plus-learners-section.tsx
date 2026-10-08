import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { Stats } from "@/components/stats";
import { type PlusBilling, listPlusLearnerCosts } from "@/data/ai/list-plus-learner-costs";
import { formatUsd } from "@/lib/ai-format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

type PlusLearners = Awaited<ReturnType<typeof listPlusLearnerCosts>>;
type PlusLearner = PlusLearners["learners"][number];

const PLAN_LABELS: Record<PlusBilling, string> = {
  granted: "Granted",
  monthly: "Monthly",
  trial: "Trial",
  yearly: "Yearly",
};

const PLAN_ORDER: PlusBilling[] = ["monthly", "yearly", "trial", "granted"];

/** The table lists the most expensive learners who made calls; the totals above count every one. */
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
  { align: "right", label: "Above plan" },
];

const learnerColumns: AdminTableColumn[] = [
  { label: "Learner" },
  { label: "Plan" },
  { label: "Goals" },
  { align: "right", label: "Calls" },
  { align: "right", label: "Cost" },
  { align: "right", label: "Pays a month" },
];

function isPaying(learner: PlusLearner): boolean {
  return learner.billing === "monthly" || learner.billing === "yearly";
}

/** A paying learner whose AI cost this month passed what their plan pays a month. */
function isAbovePlan(learner: PlusLearner): boolean {
  return isPaying(learner) && learner.paysUsd !== null && learner.costUsd > learner.paysUsd;
}

function sumCost(learners: readonly PlusLearner[]): number {
  return learners.reduce((total, learner) => total + learner.costUsd, 0);
}

function formatPays(paysUsd: number | null, billing: PlusBilling): string {
  if (billing === "trial" || billing === "granted") {
    return "Nothing";
  }

  return paysUsd === null ? "—" : formatUsd(paysUsd);
}

function Summary({ learners, prices }: Pick<PlusLearners, "learners" | "prices">) {
  const paying = learners.filter((learner) => isPaying(learner));
  const total = sumCost(learners);
  const [most] = learners;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Stats
        description={`${paying.length.toLocaleString()} paying`}
        title="Plus learners"
        value={learners.length.toLocaleString()}
      />
      <Stats
        description={`${formatUsd(learners.length > 0 ? total / learners.length : 0)} a learner on average`}
        title="Cost this month"
        value={formatUsd(total)}
      />
      <Stats
        description={
          prices
            ? `of ${paying.length.toLocaleString()} paying`
            : "Stripe's prices couldn't be read"
        }
        help={PRICE_HELP}
        title="Above their plan"
        value={prices ? learners.filter((learner) => isAbovePlan(learner)).length : "—"}
      />
      <Stats
        description={most?.user?.email ?? "Nobody yet"}
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
    <TableRow>
      <TableCell>{PLAN_LABELS[billing]}</TableCell>
      <TableCell className="text-right tabular-nums">{learners.length.toLocaleString()}</TableCell>
      <TableCell className="text-right tabular-nums">{formatPays(paysUsd, billing)}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatUsd(total)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatUsd(total / Math.max(learners.length, 1))}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatUsd(first?.costUsd ?? 0)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {billing === "trial" || billing === "granted"
          ? "—"
          : learners.filter((learner) => isAbovePlan(learner)).length.toLocaleString()}
      </TableCell>
    </TableRow>
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
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {goals.map((goal) => (
        <li className="text-xs" key={goal.id}>
          {goal.title} <span className="text-muted-foreground">({goal.kind})</span>{" "}
          <span className="tabular-nums">{formatUsd(goal.costUsd)}</span>
        </li>
      ))}
    </ul>
  );
}

function LearnerRow({ learner }: { learner: PlusLearner }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="hover:underline" href={`/users/${learner.id}`} prefetch>
          {learner.user?.name ?? learner.user?.email ?? "Deleted"}
        </Link>
        {learner.user ? (
          <span className="text-muted-foreground block text-xs">{learner.user.email}</span>
        ) : null}
      </TableCell>
      <TableCell>{PLAN_LABELS[learner.billing]}</TableCell>
      <TableCell>
        <LearnerGoals goals={learner.goals} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{learner.calls.toLocaleString()}</TableCell>
      <TableCell
        className={cn(
          "text-right font-medium tabular-nums",
          isAbovePlan(learner) && "text-destructive",
        )}
      >
        {formatUsd(learner.costUsd)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPays(learner.paysUsd, learner.billing)}
      </TableCell>
    </TableRow>
  );
}

/**
 * What each Plus learner cost this month against what their plan pays, so a higher plan or a
 * limit can be decided from data: totals and the learners above their plan, per plan, then the
 * most expensive learners with the goals that cost the most.
 */
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
      <AdminSection
        description={`Everyone with Plus now, AI calls since ${sinceLabel} (UTC), the shared content they caused included.`}
        title="Plus learners this month"
      >
        <div className="flex flex-col gap-6">
          <Summary learners={learners} prices={prices} />
          <ByPlan learners={learners} prices={prices} />
        </div>
      </AdminSection>

      <AdminSection
        description={`Up to ${LEARNER_ROWS} who made AI calls this month, most expensive first, with the goals that cost the most. Red costs more than the plan pays.`}
        title="Plus learners by cost"
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
