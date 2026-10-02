"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CircleCheck, Undo2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { DecisionTreeReview } from "./decision-tree-review";
import { findNode, reachableOutcomes, walkSteps } from "./decision-tree-walk";

type DecisionTreeProps = ActivityRendererProps<"decisionTree">;

const LONG_BRANCH_LENGTH = 24;

function outcomeLabel(node: { kind: string; label?: string } | null): string {
  return node?.kind === "outcome" ? (node.label ?? "") : "";
}

/**
 * Walk a branching key one question at a time, using what the case says. Each answer narrows
 * what's still possible; Undo steps back. Reaching an outcome is the answer; after the check,
 * the walk is compared with the one code computed from the case.
 */
export function DecisionTreeActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: DecisionTreeProps) {
  const t = useExtracted();
  const { fields } = content;
  const isChecked = phase === "checked";

  const [path, setPath] = useState<string[]>(() =>
    answer?.kind === "order" && answer.ids[0] === fields.rootId ? answer.ids : [fields.rootId],
  );

  const current = findNode(fields.nodes, path.at(-1));
  const steps = walkSteps(fields.nodes, path);
  const stillPossible = reachableOutcomes(fields.nodes, current?.id ?? fields.rootId);
  const expectedPath = expectedInteraction(expected, "order")?.ids ?? null;

  function walk(next: string[]) {
    setPath(next);
    const last = findNode(fields.nodes, next.at(-1));
    onAnswerChange(last?.kind === "outcome" ? { ids: next, kind: "order" } : null);
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <section
        aria-label={t("The case")}
        className="bg-background flex flex-col gap-1 rounded-2xl border px-3.5 py-3"
      >
        <ActivityCanvasLabel className="font-medium">{t("The case")}</ActivityCanvasLabel>
        <p className="text-base leading-snug">
          <LessonRichText text={fields.case.description} />
        </p>
      </section>

      {current?.kind === "question" && (
        <div className="flex flex-col gap-1.5">
          <ActivityCanvasLabel className="font-medium">{t("Still possible")}</ActivityCanvasLabel>
          <ul aria-label={t("Still possible")} className="flex flex-wrap gap-1.5">
            {stillPossible.map((node) => (
              <li
                className="bg-background rounded-full border px-2.5 py-1 text-xs font-medium"
                key={node.id}
              >
                {outcomeLabel(node)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <ol aria-label={t("Your answers")} className="flex flex-col gap-2">
          {steps.map((step) => (
            <li className="flex items-start gap-2.5 text-sm" key={step.node.id}>
              {/* The mark and the answer stay on the question's first line when it wraps. */}
              <LineMarker>
                <CircleCheck aria-hidden="true" className="text-muted-foreground size-[18px]" />
              </LineMarker>
              <span className="text-muted-foreground min-w-0 flex-1">
                <LessonRichText text={step.node.question} />
              </span>
              <LineMarker>
                <span className="bg-background rounded-full border px-2.5 py-1 text-xs font-medium">
                  {step.branch}
                </span>
              </LineMarker>
            </li>
          ))}
        </ol>
      )}

      {current?.kind === "question" && !isChecked && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="flex items-start gap-2.5 text-base leading-snug font-semibold">
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            >
              {steps.length + 1}
            </span>
            <LessonRichText text={current.question} />
          </p>

          <ActivitySelectGrid
            columns={
              current.branches.some((branch) => branch.label.length > LONG_BRANCH_LENGTH) ? 1 : 2
            }
            label={current.question}
          >
            {current.branches.map((branch) => (
              <ActivitySelectGridItem
                isSelected={false}
                key={branch.next}
                onToggle={() => walk([...path, branch.next])}
              >
                {branch.label}
              </ActivitySelectGridItem>
            ))}
          </ActivitySelectGrid>
        </div>
      )}

      {current?.kind === "outcome" && (
        <div
          aria-live="polite"
          className="bg-viz-accent-soft flex flex-col gap-0.5 rounded-2xl px-3.5 py-3"
        >
          <p className="text-viz-accent text-xs font-semibold">{t("The key leads to")}</p>
          <p className="text-lg font-semibold">{current.label}</p>
        </div>
      )}

      {!isChecked && path.length > 1 && (
        <Button className="self-start" onClick={() => walk(path.slice(0, -1))} variant="outline">
          <Undo2 aria-hidden="true" />
          {t("Undo")}
        </Button>
      )}

      {isChecked && expectedPath && (
        <DecisionTreeReview expectedPath={expectedPath} nodes={fields.nodes} walked={path} />
      )}

      <ActivityTextAlternative>
        {current?.kind === "outcome"
          ? t("You reached {outcome} after {count} questions.", {
              count: String(steps.length),
              outcome: current.label,
            })
          : t("Question {number}. Still possible: {outcomes}.", {
              number: String(steps.length + 1),
              outcomes: stillPossible.map((node) => outcomeLabel(node)).join(", "),
            })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
