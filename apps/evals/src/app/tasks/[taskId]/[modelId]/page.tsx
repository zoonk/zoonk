import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
  HomeLinkBreadcrumb,
  ModelPageBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { ModelStatusBadge } from "@/components/model-status-badge";
import { getTaskResults } from "@/lib/eval-runner";
import { aggregateEvalResults } from "@/lib/eval-summary";
import { getModelById, getModelDisplayName } from "@/lib/models";
import {
  combineOutputsWithTestCases,
  getOutputStatus,
  loadModelOutputs,
} from "@/lib/output-loader";
import { createReviewExportEntries } from "@/lib/review-export";
import { RUNS_PER_TEST_CASE } from "@/tasks";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerHeaderSkeleton,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { getTaskRoute } from "../_utils/task-route";
import { EvalResults } from "./eval-results";
import { TaskModelActionsCard, TaskModelActionsCardSkeleton } from "./task-model-actions-card";

type TaskModelRouteParams = PageProps<"/tasks/[taskId]/[modelId]">["params"];
type TaskModelRouteProps = { params: TaskModelRouteParams };

const getTaskModelRoute = cache(async (taskId: string, rawModelId: string) => {
  const { task } = await getTaskRoute(taskId);
  const modelId = decodeURIComponent(rawModelId);
  const model = getModelById(modelId);

  if (!model) {
    redirect(`/tasks/${taskId}`);
  }

  return { model, modelId, task, taskId };
});

async function getTaskModelRouteFromParams(params: TaskModelRouteParams) {
  const { modelId, taskId } = await params;

  return getTaskModelRoute(taskId, modelId);
}

function TaskModelBreadcrumbSkeleton() {
  return (
    <>
      <AppBreadcrumbItemSkeleton className="w-32" />
      <BreadcrumbSeparator />
      <AppBreadcrumbItemSkeleton className="w-24" />
    </>
  );
}

async function TaskModelBreadcrumb({ params }: TaskModelRouteProps) {
  const { model, task } = await getTaskModelRouteFromParams(params);

  return (
    <>
      <TaskLinkBreadcrumb taskId={task.id} taskName={task.name} />
      <BreadcrumbSeparator />
      <ModelPageBreadcrumb modelName={getModelDisplayName(model)} />
    </>
  );
}

async function TaskModelHeader({ params }: TaskModelRouteProps) {
  const { model, modelId, task, taskId } = await getTaskModelRouteFromParams(params);

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>
          {getModelDisplayName(model)} on {task.name}
        </ContainerTitle>
        <ModelStatusBadge modelId={modelId} taskId={taskId} />
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}

const getTaskModelContent = cache(async (taskId: string, rawModelId: string) => {
  const { model, modelId, task } = await getTaskModelRoute(taskId, rawModelId);

  const [results, modelOutputs, outputStatus] = await Promise.all([
    getTaskResults(taskId, modelId),
    loadModelOutputs(taskId, modelId),
    getOutputStatus({ modelId, runsPerTestCase: RUNS_PER_TEST_CASE, task }),
  ]);

  const generatedOutputs = modelOutputs
    ? combineOutputsWithTestCases({
        modelOutputs: { ...modelOutputs, outputs: results?.outputs ?? [] },
        task,
      })
    : null;

  return { generatedOutputs, model, modelId, outputStatus, results, taskId, taskName: task.name };
});

async function getTaskModelContentFromParams(params: TaskModelRouteParams) {
  const { modelId, taskId } = await params;

  return getTaskModelContent(taskId, modelId);
}

async function TaskModelActions({ params }: TaskModelRouteProps) {
  const { generatedOutputs, model, modelId, outputStatus, results, taskId, taskName } =
    await getTaskModelContentFromParams(params);

  return (
    <TaskModelActionsCard
      exportEntries={
        generatedOutputs?.outputs.map((output) => {
          const result = results?.results.find((entry) => entry.testCase.id === output.testCaseId);

          return {
            input: output.testCase.userInput,
            itemsScored: result?.itemsScored,
            keyFlaws: result?.keyFlaws,
            output: output.output,
            testCaseId: output.testCaseId,
          };
        }) ?? []
      }
      summary={aggregateEvalResults(results ?? { outputs: [], results: [] })}
      failedRuns={results?.failedRuns ?? []}
      model={model}
      modelId={modelId}
      outputStatus={outputStatus}
      reviewEntries={createReviewExportEntries({
        outputs: generatedOutputs?.outputs ?? [],
        results: results?.results ?? [],
      })}
      taskId={taskId}
      taskName={taskName}
    />
  );
}

async function TaskModelResults({ params }: TaskModelRouteProps) {
  const { generatedOutputs, outputStatus, results } = await getTaskModelContentFromParams(params);

  if (results && generatedOutputs) {
    return (
      <EvalResults
        outputs={generatedOutputs}
        results={results}
        totalRuns={outputStatus.totalOutputs}
      />
    );
  }

  return null;
}

export default function TaskModelPage({ params }: TaskModelRouteProps) {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <Suspense fallback={<TaskModelBreadcrumbSkeleton />}>
          <TaskModelBreadcrumb params={params} />
        </Suspense>
      </AppBreadcrumb>

      <Suspense fallback={<ContainerHeaderSkeleton />}>
        <TaskModelHeader params={params} />
      </Suspense>

      <ContainerBody>
        <Suspense fallback={<TaskModelActionsCardSkeleton />}>
          <TaskModelActions params={params} />
        </Suspense>

        <Suspense fallback={null}>
          <TaskModelResults params={params} />
        </Suspense>
      </ContainerBody>
    </main>
  );
}
