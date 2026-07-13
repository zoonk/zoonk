import {
  AppBreadcrumb,
  HomeLinkBreadcrumb,
  ModelPageBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getTaskResults } from "@/lib/eval-runner";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import {
  combineOutputsWithTestCases,
  getOutputStatus,
  loadModelOutputs,
} from "@/lib/output-loader";
import { RUNS_PER_TEST_CASE, TASKS } from "@/tasks";
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
import { GeneratedOutputs } from "./generated-outputs";
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

  const [results, modelOutputs, outputStatus] = await Promise.all([
    getTaskResults(taskId, modelId),
    loadModelOutputs(taskId, modelId),
    getOutputStatus({ modelId, runsPerTestCase: RUNS_PER_TEST_CASE, task }),
  ]);

  const generatedOutputs = modelOutputs
    ? combineOutputsWithTestCases({ modelOutputs, task })
    : null;

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
          exportEntries={
            generatedOutputs?.outputs.map((output) => ({
              input: output.testCase.userInput,
              output: output.output,
            })) ?? []
          }
          model={model}
          modelId={modelId}
          outputStatus={outputStatus}
          taskId={taskId}
        />

        {results ? (
          <EvalResults results={results} />
        ) : (
          generatedOutputs && <GeneratedOutputs outputs={generatedOutputs} />
        )}
      </ContainerBody>
    </main>
  );
}
