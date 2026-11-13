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

const GENERATE_FORM_ID = "generate-outputs";

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

/** The reasoning the next generation uses; its button is in the bottom bar's form. */
export function TaskModelReasoning({ model }: { model: ModelConfig }) {
  return model.kind === "generation" ? (
    <ReasoningSelect form={GENERATE_FORM_ID} reasoning={model.reasoning} />
  ) : null;
}

/**
 * Generate and score, pinned at the bottom. The one that's due is filled and last: generate until
 * every output exists, then score.
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

  const mainClass = "grow lg:grow-0";

  const generate = (
    <form
      action={generateOutputsAction}
      className={hasEveryOutput ? undefined : mainClass}
      id={GENERATE_FORM_ID}
      key="generate"
    >
      <input name="taskId" type="hidden" value={taskId} />
      <input name="modelId" type="hidden" value={modelId} />
      {model.kind !== "generation" && (
        <input name="reasoning" type="hidden" value={DEFAULT_REASONING} />
      )}
      <SubmitButton
        full={!hasEveryOutput}
        size="lg"
        variant={hasEveryOutput ? "outline" : "default"}
      >
        Generate outputs
      </SubmitButton>
    </form>
  );

  const score = (
    <form action={runEvalAction} className={hasEveryOutput ? mainClass : undefined} key="score">
      <input name="taskId" type="hidden" value={taskId} />
      <input name="modelId" type="hidden" value={modelId} />
      <SubmitButton
        disabled={!hasOutputs}
        full={hasEveryOutput}
        size="lg"
        variant={needsEval ? "default" : "outline"}
      >
        Score outputs
      </SubmitButton>
    </form>
  );

  return (
    <BottomBar>
      <BottomBarActions>{hasEveryOutput ? [generate, score] : [score, generate]}</BottomBarActions>
    </BottomBar>
  );
}
