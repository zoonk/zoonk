import { type Decision } from "@/lib/comparisons/decision";
import { canAdjudicate } from "@/lib/comparisons/evidence";
import { type Attempt, type Comparison, type SealedPacket } from "@/lib/comparisons/schemas";
import { Badge } from "@zoonk/ui/components/badge";
import { CaseInput } from "../../../_components/case-input";
import { CaseRuns } from "../../../_components/case-view";
import { type ReadView, caseRuns } from "../../../_utils/case-evidence";
import { SIDE_LABELS, type Side, familyLabel, variantName } from "../../../_utils/labels";
import { RulingForm } from "../../ruling-form";

type Mapping = SealedPacket["mapping"][number];

function choiceText(choice: Side | "tie"): string {
  return choice === "tie" ? "a tie" : `the ${SIDE_LABELS[choice].toLowerCase()} model`;
}

function whoWroteWhat(comparison: Comparison, mapping: Mapping): string {
  const { challenger, incumbent } = comparison.manifest.variants;

  if (!incumbent) {
    return `The answer was ${variantName(challenger)}’s.`;
  }

  const name = (side: Side) =>
    `${SIDE_LABELS[side].toLowerCase()} model, ${variantName(side === "incumbent" ? incumbent : challenger)}`;

  const second = mapping.first === "incumbent" ? "challenger" : "incumbent";

  return `A was the ${name(mapping.first)}. B was the ${name(second)}.`;
}

function Agreement({ owner, reads }: { owner: ReadView | undefined; reads: ReadView[] }) {
  const others = reads.filter((read) => read.reader.channel !== "owner" && read.overall);

  if (!owner?.overall) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        You preferred <span className="font-medium">{choiceText(owner.overall.choice)}</span>.
      </p>
      {others.length === 0 ? (
        <p className="text-muted-foreground text-sm">No model reader has read this case yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {others.map((read) => {
            const agrees = read.overall?.choice === owner.overall?.choice;

            return (
              <li className="flex flex-wrap items-center gap-2" key={read.key}>
                <span>
                  {familyLabel(read.reader.family)}
                  {read.reverse && " (reverse order)"} preferred{" "}
                  {read.overall && choiceText(read.overall.choice)}
                </span>
                <Badge variant={agrees ? "success" : "destructive"}>
                  {agrees ? "Agrees" : "Disagrees"}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** After the owner reads a case blind: who wrote A and B, where the model readers agree with the owner, and all they saw. */
export function Reveal({
  attempt,
  comparison,
  decision,
  packet,
}: {
  attempt: Attempt;
  comparison: Comparison;
  decision: Decision;
  packet: SealedPacket;
}) {
  const real = packet.mapping.find((entry) => entry.kind === "real");

  if (!real) {
    return null;
  }

  const run = caseRuns(comparison, real.caseId).find((entry) => entry.run === real.run);
  const testCase = comparison.manifest.cases.find((entry) => entry.id === real.caseId);
  const owner = run?.reads.find((read) => read.key === `${packet.id}-${attempt.attempt}`);
  const decisionCase = decision.cases.find((item) => item.caseId === real.caseId);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-lg flex-col gap-3">
        <p className="text-sm font-medium">{whoWroteWhat(comparison, real)}</p>
        <Agreement owner={owner} reads={run?.reads ?? []} />
      </section>

      {decisionCase && canAdjudicate(comparison.manifest, decisionCase) && (
        <RulingForm
          blindRead={decisionCase.owner}
          caseId={real.caseId}
          comparisonId={comparison.manifest.id}
          taskId={comparison.manifest.taskId}
        />
      )}

      {testCase && <CaseInput expectations={testCase.expectations} input={testCase.input} />}
      {run && <CaseRuns caseId={real.caseId} comparison={comparison} runs={[run]} />}
    </div>
  );
}
