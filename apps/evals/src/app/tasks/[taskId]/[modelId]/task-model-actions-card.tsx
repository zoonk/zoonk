import { ModelStatusBadge } from "@/components/model-status-badge";
import { type ModelConfig } from "@/lib/models";
import { type OutputStatus } from "@/lib/output-loader";
import { Button } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { PlayIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { generateOutputsAction, runEvalAction } from "./actions";

export function TaskModelActionsCard({
  model,
  modelId,
  outputStatus,
  taskId,
}: {
  model: ModelConfig;
  modelId: string;
  outputStatus: { status: OutputStatus; completedTestCases: number; totalTestCases: number };
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
              {outputStatus.completedTestCases}/{outputStatus.totalTestCases} outputs generated
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
        </div>
      </CardContent>
    </Card>
  );
}
