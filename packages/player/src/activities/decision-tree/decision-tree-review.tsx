"use client";

import { Check, Dot, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { type TreeNode, findNode, firstDivergence, walkSteps } from "./decision-tree-walk";

/**
 * After the check: the walk code computed from the case, question by question, with the first
 * place the learner's walk left it.
 */
export function DecisionTreeReview({
  expectedPath,
  nodes,
  walked,
}: {
  expectedPath: readonly string[];
  nodes: readonly TreeNode[];
  walked: readonly string[];
}) {
  const t = useExtracted();
  const divergence = firstDivergence(expectedPath, walked);
  const steps = walkSteps(nodes, expectedPath);
  const outcome = findNode(nodes, expectedPath.at(-1));
  const learnerSteps = walkSteps(nodes, walked);

  return (
    <section
      aria-label={t("The walk for this case")}
      className="bg-background flex flex-col gap-2 rounded-2xl border px-3.5 py-3"
      data-slot="decision-tree-review"
    >
      <p className="text-sm font-semibold">{t("The walk for this case")}</p>

      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const missedAt = divergence === null ? steps.length : divergence - 1;
          const isMissed = index === missedAt;
          const learnerBranch = learnerSteps[index]?.branch;

          return (
            <li className="flex items-start gap-2.5 text-sm leading-snug" key={step.node.id}>
              {index < missedAt && (
                <Check aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
              )}
              {isMissed && (
                <X aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />
              )}
              {index > missedAt && (
                <Dot aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              )}

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-muted-foreground">
                  <LessonRichText text={step.node.question} />
                </span>
                <span className="font-medium">{step.branch}</span>
                {isMissed && learnerBranch && (
                  <span className="text-destructive text-xs">
                    {t("You chose {branch}", { branch: learnerBranch })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {outcome?.kind === "outcome" && (
        <p className="border-t pt-2 text-sm">
          {t("It leads to {outcome}.", { outcome: outcome.label })}
        </p>
      )}
    </section>
  );
}
