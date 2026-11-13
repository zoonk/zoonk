import { FormMainButton } from "@/components/form-main-button";
import { type EvalSummary } from "@/lib/eval-summary";
import { DEFAULT_REASONING, type ModelConfig } from "@/lib/models";
import { type OutputProgress } from "@/lib/output-loader";
import { type ReviewExportEntry } from "@/lib/review-export";
import { type FailedRun } from "@/lib/types";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { generateOutputsAction, runEvalAction } from "./actions";
import { DeleteModelDataDialog } from "./delete-model-data-dialog";
import { type OutputExportEntry, OutputsExport } from "./outputs-export";
import { ReasoningSelect } from "./reasoning-select";
import { ReviewPdfExport } from "./review-pdf-export";

const RUN_FORM_ID = "model-run";

/** Exports and delete, at the end of the page top's bar. */
export function TaskModelFileActions({
  exportEntries,
  failedRuns,
  modelId,
  reviewEntries,
  summary,
  taskId,
  taskName,
}: {
  exportEntries: OutputExportEntry[];
  failedRuns: FailedRun[];
  modelId: string;
  reviewEntries: ReviewExportEntry[];
  summary: EvalSummary;
  taskId: string;
  taskName: string;
}) {
  return (
    <>
      <OutputsExport entries={exportEntries} failedRuns={failedRuns} summary={summary} />

      <ReviewPdfExport
        entries={reviewEntries}
        key={`${taskId}-${modelId}`}
        modelId={modelId}
        summary={summary}
        taskId={taskId}
        taskName={taskName}
      />

      <DeleteModelDataDialog disabled={summary.attempted === 0} modelId={modelId} taskId={taskId} />
    </>
  );
}

/** The reasoning the next generation uses; it belongs to the bottom bar's form. */
export function TaskModelReasoning({ model }: { model: ModelConfig }) {
  return model.kind === "generation" ? (
    <ReasoningSelect form={RUN_FORM_ID} reasoning={model.reasoning} />
  ) : null;
}

/**
 * Generate and score, pinned at the bottom, in one form that each button sends to its own action.
 * The one that's due is the main action, filled and last: generate until every output exists, then
 * score until every output is scored. Enter presses neither, so neither shows its key.
 */
export function TaskModelRunBar({
  model,
  modelId,
  outputStatus,
  summary,
  taskId,
}: {
  model: ModelConfig;
  modelId: string;
  outputStatus: OutputProgress;
  summary: EvalSummary;
  taskId: string;
}) {
  const hasOutputs = outputStatus.status !== "missing";
  const hasEveryOutput = outputStatus.status === "complete";
  const needsEval = hasEveryOutput && summary.scored < outputStatus.totalOutputs;

  const generate = hasEveryOutput ? (
    <SubmitButton formAction={generateOutputsAction} key="generate" size="lg" variant="outline">
      Generate outputs
    </SubmitButton>
  ) : (
    <FormMainButton enter="off" formAction={generateOutputsAction} key="generate">
      Generate outputs
    </FormMainButton>
  );

  const score = needsEval ? (
    <FormMainButton enter="off" formAction={runEvalAction} key="score">
      Score outputs
    </FormMainButton>
  ) : (
    <SubmitButton
      disabled={!hasOutputs}
      formAction={runEvalAction}
      key="score"
      size="lg"
      variant="outline"
    >
      Score outputs
    </SubmitButton>
  );

  return (
    <form className="contents" id={RUN_FORM_ID}>
      <input name="taskId" type="hidden" value={taskId} />
      <input name="modelId" type="hidden" value={modelId} />
      {model.kind !== "generation" && (
        <input name="reasoning" type="hidden" value={DEFAULT_REASONING} />
      )}

      <BottomBar>
        <BottomBarActions>
          {hasEveryOutput ? [generate, score] : [score, generate]}
        </BottomBarActions>
      </BottomBar>
    </form>
  );
}
