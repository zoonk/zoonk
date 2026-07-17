import { ModelStatusBadge, ModelStatusBadgeSkeleton } from "@/components/model-status-badge";
import { type ModelConfig } from "@/lib/models";
import { type OutputProgress } from "@/lib/output-loader";
import { Button, ButtonSkeleton } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { DownloadIcon, PlayIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { generateOutputsAction, runEvalAction } from "./actions";
import { type OutputExportEntry, OutputsExport } from "./outputs-export";

export function TaskModelActionsCard({
  exportEntries,
  model,
  modelId,
  outputStatus,
  taskId,
}: {
  exportEntries: OutputExportEntry[];
  model: ModelConfig;
  modelId: string;
  outputStatus: OutputProgress;
  taskId: string;
}) {
  const hasOutputs = outputStatus.status !== "missing";
  const hasCompleteOutputs = outputStatus.status === "complete";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Actions
          <ModelStatusBadge modelId={modelId} taskId={taskId} />
        </CardTitle>
        <CardDescription>Evaluating with {model?.name || modelId}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <form action={generateOutputsAction}>
            <input name="taskId" type="hidden" value={taskId} />
            <input name="modelId" type="hidden" value={modelId} />
            <SubmitButton disabled={hasCompleteOutputs} icon={<SparklesIcon />}>
              Generate Outputs
            </SubmitButton>
          </form>

          {hasOutputs && (
            <span className="text-muted-foreground text-sm">
              {outputStatus.completedOutputs}/{outputStatus.totalOutputs} outputs generated
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <form action={runEvalAction}>
            <input name="taskId" type="hidden" value={taskId} />
            <input name="modelId" type="hidden" value={modelId} />
            <SubmitButton disabled={!hasOutputs} icon={<PlayIcon />}>
              Run Eval
            </SubmitButton>
          </form>

          <Link href={`/tasks/${taskId}`}>
            <Button type="button" variant="outline">
              Change Model
            </Button>
          </Link>

          <OutputsExport entries={exportEntries} />
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
        <div className="flex items-center gap-4">
          <ButtonSkeleton>
            <SparklesIcon />
            Generate Outputs
          </ButtonSkeleton>
          <Skeleton className="h-5 w-40 rounded" />
        </div>

        <div className="flex items-center gap-4">
          <ButtonSkeleton>
            <PlayIcon />
            Run Eval
          </ButtonSkeleton>
          <ButtonSkeleton variant="outline">Change Model</ButtonSkeleton>
          <ButtonSkeleton variant="outline">
            <DownloadIcon />
            Export Outputs
          </ButtonSkeleton>
        </div>
      </CardContent>
    </Card>
  );
}
