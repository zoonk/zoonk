import { ModelStatusBadge, ModelStatusBadgeSkeleton } from "@/components/model-status-badge";
import { type ModelConfig, getModelDisplayName } from "@/lib/models";
import { type OutputProgress } from "@/lib/output-loader";
import { type ReviewExportEntry } from "@/lib/review-export";
import { ButtonSkeleton } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
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
  model,
  modelId,
  outputStatus,
  reviewEntries,
  taskId,
  taskName,
}: {
  exportEntries: OutputExportEntry[];
  model: ModelConfig;
  modelId: string;
  outputStatus: OutputProgress;
  reviewEntries: ReviewExportEntry[];
  taskId: string;
  taskName: string;
}) {
  const hasOutputs = outputStatus.status !== "missing";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Actions
          <ModelStatusBadge modelId={modelId} taskId={taskId} />
        </CardTitle>
        <CardDescription>Evaluating with {getModelDisplayName(model)}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <form action={generateOutputsAction} className="flex flex-wrap items-end gap-3">
            <input name="taskId" type="hidden" value={taskId} />
            <input name="modelId" type="hidden" value={modelId} />

            <ReasoningSelect reasoning={model.reasoning} />

            <SubmitButton icon={<SparklesIcon />}>Generate Outputs</SubmitButton>
          </form>

          {hasOutputs && (
            <span className="text-muted-foreground text-sm">
              {outputStatus.completedOutputs}/{outputStatus.totalOutputs} outputs generated
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <form action={runEvalAction}>
            <input name="taskId" type="hidden" value={taskId} />
            <input name="modelId" type="hidden" value={modelId} />
            <SubmitButton disabled={!hasOutputs} icon={<PlayIcon />}>
              Run Eval
            </SubmitButton>
          </form>

          <DeleteModelDataDialog disabled={!hasOutputs} modelId={modelId} taskId={taskId} />

          <OutputsExport entries={exportEntries} />

          <ReviewPdfExport
            entries={reviewEntries}
            key={`${taskId}-${modelId}`}
            taskName={taskName}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Uses the action card's real header, content rows, badge, and button geometry
 * so filesystem-backed state can stream in without resizing the card.
 */
export function TaskModelActionsCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded" />
          <ModelStatusBadgeSkeleton />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-5 w-48 rounded" />
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-9 w-40 rounded-full" />
            </div>
            <ButtonSkeleton>
              <SparklesIcon />
              Generate Outputs
            </ButtonSkeleton>
          </div>
          <Skeleton className="h-5 w-40 rounded" />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <ButtonSkeleton>
            <PlayIcon />
            Run Eval
          </ButtonSkeleton>
          <ButtonSkeleton variant="destructive">
            <Trash2Icon />
            Delete Outputs &amp; Results
          </ButtonSkeleton>
          <ButtonSkeleton variant="outline">
            <DownloadIcon />
            Export Outputs
          </ButtonSkeleton>
          <ButtonSkeleton variant="outline">
            <FileTextIcon />
            Export review PDF
          </ButtonSkeleton>
        </div>
      </CardContent>
    </Card>
  );
}
