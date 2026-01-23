import {
  AppBreadcrumb,
  HomeLinkBreadcrumb,
  ModelPageBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { ModelStatusBadge } from "@/components/model-status-badge";
import { getTaskResults } from "@/lib/eval-runner";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import { getOutputStatus } from "@/lib/output-loader";
import { TASKS } from "@/tasks";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import { Button } from "@zoonk/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { PlayIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { generateOutputsAction, runEvalAction } from "./actions";
import { EvalResults } from "./eval-results";

export default async function TaskModelPage({ params }: PageProps<"/tasks/[taskId]/[modelId]">) {
  const { taskId, modelId: rawModelId } = await params;
  const task = TASKS.find((item) => item.id === taskId);

  if (!task) {
    notFound();
  }

  const modelId = decodeURIComponent(rawModelId);
  const model = EVAL_MODELS.find((item) => item.id === modelId);

  if (!model) {
    redirect(`/tasks/${taskId}`);
  }

  const [results, outputStatus] = await Promise.all([
    getTaskResults(taskId, modelId),
    getOutputStatus(taskId, modelId, task.testCases.length),
  ]);

  const hasOutputs = outputStatus.status !== "missing";
  const hasCompleteOutputs = outputStatus.status === "complete";

  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskLinkBreadcrumb taskId={task.id} taskName={task.name} />
        <BreadcrumbSeparator />
        <ModelPageBreadcrumb modelName={getModelDisplayName(model)} />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{task.name}</ContainerTitle>
          <ContainerDescription>
            Generate outputs and run evaluations for this task
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
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

        {results && <EvalResults results={results} />}
      </ContainerBody>
    </main>
  );
}
