import {
  AppBreadcrumb,
  HomeLinkBreadcrumb,
  ModelPageBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getTaskResults } from "@/lib/eval-runner";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import { getOutputStatus } from "@/lib/output-loader";
import { TASKS } from "@/tasks";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { notFound, redirect } from "next/navigation";
import { EvalResults } from "./eval-results";
import { TaskModelActionsCard } from "./task-model-actions-card";

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
        <TaskModelActionsCard
          model={model}
          modelId={modelId}
          outputStatus={outputStatus}
          taskId={taskId}
        />

        {results && <EvalResults results={results} />}
      </ContainerBody>
    </main>
  );
}
