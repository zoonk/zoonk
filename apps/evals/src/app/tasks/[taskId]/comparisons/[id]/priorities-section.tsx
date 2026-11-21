import { type Comparison, type TaskPriorities } from "@/lib/comparisons/schemas";
import { humanizeKey } from "../_utils/words";

type Rules = NonNullable<TaskPriorities["comparison"]>;

const PREFERENCE_LABELS: Record<Rules["preference"], string> = {
  canBlock: "Can keep the current model even when the challenger is cheaper.",
  separates: "Only picks between two models that both qualify.",
};

const CRITERION_RULES: Record<Rules["criteria"][string], string> = {
  counts: "weighs in the trade",
  disqualifies: "rules a model out",
};

function criterionRule(rules: Rules, criterion: string): string {
  const rule = rules.criteria[criterion];
  const weight = rules.weights?.[criterion] ?? 1;

  if (rule === "counts" && weight > 1) {
    return `Counts as ${weight} major-affected cases per affected case`;
  }

  return rule ? CRITERION_RULES[rule] : "not stated";
}

function tradeText(trade: Rules["trade"]): string {
  if (!trade) {
    return "Not set yet. How much quality to give up for a saving is the owner’s call.";
  }

  const savings = [
    trade.saveCostShare !== null && `${Math.round(trade.saveCostShare * 100)}% of the cost`,
    trade.saveSeconds !== null && `${trade.saveSeconds}s at p50`,
  ].filter(Boolean);

  return `Up to ${trade.majorIncreasePer100} more weighted major-affected cases per 100 matched cases, in each language, when it saves at least ${savings.join(" or ")}.`;
}

function Fact({ children, label }: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-6">
      <dt className="text-muted-foreground shrink-0 sm:w-44">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The task's priorities as the comparison froze them, which the outcome was decided by. */
export function PrioritiesSection({ manifest }: { manifest: Comparison["manifest"] }) {
  const { priorities } = manifest;
  const rules = priorities.comparison;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">What this task values</h2>

      <dl className="flex max-w-3xl flex-col gap-3 text-sm">
        <Fact label="Who reads it">{priorities.reads}</Fact>
        <Fact label="Who waits for it">{priorities.waits}</Fact>
        <Fact label="Shared or private">
          {priorities.distribution === "shared"
            ? "Shared: written once and shown to many learners"
            : "Private: written for one learner"}
        </Fact>
        <Fact label="What matters most">
          {humanizeKey(priorities.first)}. {priorities.reason}
        </Fact>

        {rules && (
          <>
            <Fact label="A confirmed major problem">
              <ul className="flex flex-col gap-0.5">
                {manifest.criteria.map((criterion) => (
                  <li key={criterion.id}>
                    {criterion.label}: {criterionRule(rules, criterion.id)}
                  </li>
                ))}
              </ul>
            </Fact>
            <Fact label="Readers’ overall preference">{PREFERENCE_LABELS[rules.preference]}</Fact>
            <Fact label="Trade it accepts">{tradeText(rules.trade)}</Fact>
          </>
        )}
      </dl>
    </section>
  );
}
