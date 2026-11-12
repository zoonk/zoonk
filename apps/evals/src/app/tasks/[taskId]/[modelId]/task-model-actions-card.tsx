import { type EvalSummary } from "@/lib/eval-summary";
import { DEFAULT_REASONING, type ModelConfig } from "@/lib/models";
import { type OutputProgress } from "@/lib/output-loader";
import { type ReviewExportEntry } from "@/lib/review-export";
import { type FailedRun } from "@/lib/types";
import { ButtonSkeleton } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { DownloadIcon, FileTextIcon, PlayIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { generateOutputsAction, runEvalAction } from "./actions";
import { DeleteModelDataDialog } from "./delete-model-data-dialog";
import { type OutputExportEntry, OutputsExport } from "./outputs-export";
import { ReasoningSelect } from "./reasoning-select";
import { ReviewPdfExport } from "./review-pdf-export";

export function TaskModelActionsCard({
  exportEntries,
  failedRuns,
  summary,
  model,
  modelId,
  outputStatus,
  reviewEntries,
  taskId,
  taskName,
}: {
  exportEntries: OutputExportEntry[];
  failedRuns: FailedRun[];
  summary: EvalSummary;
  model: ModelConfig;
  modelId: string;
  outputStatus: OutputProgress;
  reviewEntries: ReviewExportEntry[];
  taskId: string;
  taskName: string;
}) {
  const hasOutputs = outputStatus.status !== "missing";
  const hasEveryOutput = outputStatus.status === "complete";
  const needsEval = hasEveryOutput && summary.scored < outputStatus.totalOutputs;

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-4 border-b pb-6">
      <form action={generateOutputsAction} className="flex flex-wrap items-end gap-3">
        <input name="taskId" type="hidden" value={taskId} />
        <input name="modelId" type="hidden" value={modelId} />

        {model.kind === "generation" ? (
          <ReasoningSelect reasoning={model.reasoning} />
        ) : (
          <input name="reasoning" type="hidden" value={DEFAULT_REASONING} />
        )}

        <SubmitButton icon={<SparklesIcon />} variant={hasEveryOutput ? "outline" : "default"}>
          Generate outputs
        </SubmitButton>
      </form>

      <form action={runEvalAction}>
        <input name="taskId" type="hidden" value={taskId} />
        <input name="modelId" type="hidden" value={modelId} />
        <SubmitButton
          disabled={!hasOutputs}
          icon={<PlayIcon />}
          variant={needsEval ? "default" : "outline"}
        >
          Run eval
        </SubmitButton>
      </form>

      {hasOutputs && (
        <span className="text-muted-foreground min-h-9 content-center font-mono text-xs">
          {outputStatus.completedOutputs}/{outputStatus.totalOutputs} outputs
        </span>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
        <OutputsExport entries={exportEntries} failedRuns={failedRuns} summary={summary} />

        <ReviewPdfExport
          entries={reviewEntries}
          summary={summary}
          modelId={modelId}
          taskId={taskId}
          key={`${taskId}-${modelId}`}
          taskName={taskName}
        />

        <DeleteModelDataDialog
          disabled={summary.attempted === 0}
          modelId={modelId}
          taskId={taskId}
        />
      </div>
    </div>
  );
}

export function TaskModelActionsCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-end gap-x-3 gap-y-4 border-b pb-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <ButtonSkeleton>
        <SparklesIcon />
        Generate outputs
      </ButtonSkeleton>
      <ButtonSkeleton variant="outline">
        <PlayIcon />
        Run eval
      </ButtonSkeleton>

      <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
        <ButtonSkeleton variant="outline">
          <DownloadIcon />
          Export outputs
        </ButtonSkeleton>
        <ButtonSkeleton variant="outline">
          <FileTextIcon />
          Export review PDF
        </ButtonSkeleton>
        <ButtonSkeleton variant="destructive">
          <Trash2Icon />
          Delete
        </ButtonSkeleton>
      </div>
    </div>
  );
}
