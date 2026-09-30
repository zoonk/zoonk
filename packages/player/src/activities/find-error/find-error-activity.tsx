"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { BotIcon, Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";

type FindErrorProps = ActivityRendererProps<"findError">;
type StepVerdict = "error" | "picked" | "plain";

function StepNumber({ index, verdict }: { index: number; verdict: StepVerdict }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        verdict === "plain" && "bg-muted",
        verdict === "error" && "bg-success text-background",
        verdict === "picked" && "bg-destructive text-background",
      )}
    >
      {verdict === "error" && <Check className="size-4" />}
      {verdict === "picked" && <X className="size-4" />}
      {verdict === "plain" && index + 1}
    </span>
  );
}

/** A worked step to tap; after the check, the wrong one is struck through with its fix. */
function FindErrorStep({
  correction,
  index,
  isChecked,
  isPicked,
  onToggle,
  text,
  verdict,
}: {
  correction: string;
  index: number;
  isChecked: boolean;
  isPicked: boolean;
  onToggle: () => void;
  text: string;
  verdict: StepVerdict;
}) {
  const t = useExtracted();

  return (
    <button
      aria-label={t("Step {number}: {text}", { number: String(index + 1), text })}
      aria-pressed={isChecked ? undefined : isPicked}
      className={cn(
        "bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-11 w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm leading-snug outline-none focus-visible:ring-[3px] sm:text-base",
        !isChecked && !isPicked && "hover:bg-accent",
        !isChecked && isPicked && "border-primary ring-primary/15 ring-[3px]",
        verdict === "error" && "border-success bg-success/10 border-2",
        verdict === "picked" && "border-destructive bg-destructive/10 border-2",
      )}
      disabled={isChecked}
      onClick={onToggle}
      type="button"
    >
      {/* Centered on the step's first line, however many lines it wraps to. */}
      <LineMarker>
        <StepNumber index={index} verdict={isChecked ? verdict : "plain"} />
      </LineMarker>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            verdict === "error" &&
              "text-muted-foreground decoration-destructive line-through decoration-2",
          )}
        >
          <LessonRichText text={text} />
        </span>

        {verdict === "error" && (
          <span className="text-success font-medium">
            <LessonRichText text={correction} />
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * A worked answer with one wrong step: the learner taps the step they think is wrong. After the
 * check the wrong step (from the fields, confirmed by code when it has math) is struck through
 * with its correction and why, and a different pick is marked.
 */
export function FindErrorActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: FindErrorProps) {
  const t = useExtracted();
  const { fields } = content;
  const isChecked = phase === "checked";
  const pickedId = answer?.kind === "selection" ? (answer.ids[0] ?? null) : null;
  const errorId = expectedInteraction(expected, "selection")?.ids[0] ?? null;
  const isAiAnswer = fields.author === "ai";

  function verdictOf(stepId: string): StepVerdict {
    if (stepId === errorId) {
      return "error";
    }

    return isChecked && stepId === pickedId ? "picked" : "plain";
  }

  function toggle(stepId: string) {
    onAnswerChange(stepId === pickedId ? null : { ids: [stepId], kind: "selection" });
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <div className="flex flex-col gap-1">
        <ActivityCanvasLabel className="font-medium">
          {isAiAnswer ? t("Someone asked an AI assistant") : t("Problem")}
        </ActivityCanvasLabel>
        <p className="text-base leading-snug font-medium">
          <LessonRichText text={fields.problem} />
        </p>
      </div>

      {isAiAnswer && (
        <p
          className="text-muted-foreground flex items-start gap-2 text-sm"
          data-slot="find-error-ai-label"
        >
          <LineMarker>
            <BotIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("The AI's answer. One step is wrong: spot the AI's mistake.")}
        </p>
      )}

      <ol
        aria-label={isAiAnswer ? t("The AI assistant's answer") : t("Worked answer")}
        className="flex flex-col gap-2"
      >
        {fields.steps.map((step, index) => {
          const verdict = verdictOf(step.id);

          return (
            <li key={step.id}>
              <FindErrorStep
                correction={fields.correction}
                index={index}
                isChecked={isChecked}
                isPicked={step.id === pickedId}
                onToggle={() => toggle(step.id)}
                text={step.text}
                verdict={verdict}
              />
            </li>
          );
        })}
      </ol>

      {isChecked && (
        <div className="flex flex-col gap-1.5" data-slot="find-error-why">
          {pickedId !== errorId && (
            <p className="text-sm">
              {t("The wrong step is step {number}.", {
                number: String(fields.steps.findIndex((step) => step.id === errorId) + 1),
              })}
            </p>
          )}

          <p className="text-muted-foreground text-sm leading-relaxed">
            <LessonRichText text={fields.why} />
          </p>
        </div>
      )}

      <ActivityTextAlternative>
        {isAiAnswer
          ? t("An AI assistant's answer in {count} steps. One step is wrong; pick it.", {
              count: String(fields.steps.length),
            })
          : t("A worked answer in {count} steps. One step is wrong; pick it.", {
              count: String(fields.steps.length),
            })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
