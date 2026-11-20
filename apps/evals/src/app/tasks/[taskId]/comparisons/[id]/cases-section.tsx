import { Fold } from "@/components/fold";
import { FoldRowTitle } from "@/components/fold-row-title";
import { type Decision } from "@/lib/comparisons/decision";
import { canAdjudicate } from "@/lib/comparisons/evidence";
import { type Comparison } from "@/lib/comparisons/schemas";
import { CaseInput } from "../_components/case-input";
import { CaseRuns, caseVotesLine } from "../_components/case-view";
import { caseRuns, orderCases } from "../_utils/case-evidence";
import { DIRECTION_LABELS } from "../_utils/labels";
import { RulingForm } from "./ruling-form";

type Case = Decision["cases"][number];

function resultText(item: Case): string {
  if (item.adjudication) {
    return `${DIRECTION_LABELS[item.result]}, your ruling`;
  }

  return item.owner
    ? `${DIRECTION_LABELS[item.result]}, your blind read: ${DIRECTION_LABELS[item.owner]}`
    : DIRECTION_LABELS[item.result];
}

function CaseVotes({ item }: { item: Case }) {
  const votes = caseVotesLine(item.votes);

  return (
    <div className="flex max-w-3xl flex-col gap-1 text-sm">
      <p>
        <span className="text-muted-foreground">Families: </span>
        {votes || "no complete reads yet"}
        {item.owner && (
          <>
            <span className="text-muted-foreground"> · Your blind read: </span>
            {DIRECTION_LABELS[item.owner]}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Every case, the ones that still need a call first. A case the owner hasn't read blind starts
 * closed, since opening it shows which model wrote each answer.
 */
export function CasesSection({
  comparison,
  decision,
  unread,
}: {
  comparison: Comparison;
  decision: Decision;
  unread: string[];
}) {
  const { manifest } = comparison;
  const audit = !manifest.variants.incumbent;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Cases</h2>
        {unread.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Opening a case shows which model wrote each answer, so read blind first.
          </p>
        )}
      </div>

      <div className="flex flex-col">
        {orderCases(decision.cases).map((item) => {
          const testCase = manifest.cases.find((entry) => entry.id === item.caseId);

          return (
            <section
              className="scroll-mt-4 border-t py-1 first:border-t-0"
              id={`case-${item.caseId}`}
              key={item.caseId}
            >
              <Fold
                isOpen={!unread.includes(item.caseId) && item.result !== "tie"}
                title={
                  <FoldRowTitle title={item.caseId}>
                    {!audit && <span className="font-sans">{resultText(item)}</span>}
                  </FoldRowTitle>
                }
              >
                <div className="flex flex-col gap-6 pt-2 pb-6">
                  {!audit && <CaseVotes item={item} />}
                  {canAdjudicate(manifest, item) && (
                    <RulingForm
                      blindRead={item.owner}
                      caseId={item.caseId}
                      comparisonId={manifest.id}
                      ruling={item.adjudication}
                      taskId={manifest.taskId}
                    />
                  )}
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
