import { Fold } from "@/components/fold";
import { type Decision } from "@/lib/comparisons/decision";
import { type Comparison } from "@/lib/comparisons/schemas";
import { CaseInput } from "../_components/case-input";
import { CaseRuns, caseVotesLine } from "../_components/case-view";
import { caseRuns, orderCases } from "../_utils/case-evidence";
import { DIRECTION_LABELS, languageName } from "../_utils/labels";

function caseTitle(item: Decision["cases"][number], audit: boolean): string {
  const parts = [item.caseId, languageName(item.language)];

  const result = item.owner
    ? `${DIRECTION_LABELS[item.result]}, your call: ${DIRECTION_LABELS[item.owner]}`
    : DIRECTION_LABELS[item.result];

  return audit ? parts.join(" · ") : [...parts, result].join(" · ");
}

function CaseVotes({ item }: { item: Decision["cases"][number] }) {
  const votes = caseVotesLine(item.votes);

  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Families: </span>
      {votes || "no complete reads yet"}
      {item.owner && (
        <>
          <span className="text-muted-foreground"> · Your read: </span>
          {DIRECTION_LABELS[item.owner]}
        </>
      )}
    </p>
  );
}

/**
 * Every case, the ones that still need a call first. While the owner's blind read is pending they
 * start closed, since opening one shows which model wrote each answer.
 */
export function CasesSection({
  comparison,
  decision,
  ownerPending,
}: {
  comparison: Comparison;
  decision: Decision;
  ownerPending: boolean;
}) {
  const audit = !comparison.manifest.variants.incumbent;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Cases</h2>
        {ownerPending && (
          <p className="text-muted-foreground text-sm">
            Opening a case shows which model wrote each answer, so read blind first.
          </p>
        )}
      </div>

      <div className="flex flex-col">
        {orderCases(decision.cases).map((item) => {
          const testCase = comparison.manifest.cases.find((entry) => entry.id === item.caseId);

          return (
            <section
              className="scroll-mt-4 border-t py-1 first:border-t-0"
              id={`case-${item.caseId}`}
              key={item.caseId}
            >
              <Fold isOpen={!ownerPending && item.result !== "tie"} title={caseTitle(item, audit)}>
                <div className="flex flex-col gap-6 pt-2 pb-6">
                  {!audit && <CaseVotes item={item} />}
                  {testCase && (
                    <CaseInput expectations={testCase.expectations} input={testCase.input} />
                  )}
                  <CaseRuns
                    caseId={item.caseId}
                    comparison={comparison}
                    runs={caseRuns(comparison, item.caseId)}
                  />
                </div>
              </Fold>
            </section>
          );
        })}
      </div>
    </section>
  );
}
