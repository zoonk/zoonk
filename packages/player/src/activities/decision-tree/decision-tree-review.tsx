"use client";

import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { Check, Dot, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { type TreeNode, findNode, firstDivergence, walkSteps } from "./decision-tree-walk";

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
      className="bg-background flex flex-col gap-2 rounded-xl border px-3.5 py-3"
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
                <Check aria-hidden="true" className="text-success-text mt-0.5 size-4 shrink-0" />
              )}
              {isMissed && (
                <X aria-hidden="true" className="text-destructive-text mt-0.5 size-4 shrink-0" />
              )}
              {index > missedAt && (
                <Dot aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="text-muted-foreground">
                  <RichTextBlocks text={step.node.question} />
                </div>
                <span className="font-medium">{step.branch}</span>
                {isMissed && learnerBranch && (
                  <span className="text-destructive-text text-xs">
                    {t("You chose {branch}", { branch: learnerBranch })}
                  </span>
                )}
              </div>
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
