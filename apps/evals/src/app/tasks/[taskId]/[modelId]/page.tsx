import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
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
import { RUNS_PER_TEST_CASE } from "@/tasks";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerHeaderSkeleton,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { getTaskRoute } from "../_utils/task-route";
import { EvalResults } from "./eval-results";
import { GeneratedOutputs } from "./generated-outputs";
import { TaskModelActionsCard, TaskModelActionsCardSkeleton } from "./task-model-actions-card";

type TaskModelRouteParams = PageProps<"/tasks/[taskId]/[modelId]">["params"];
type TaskModelRouteProps = { params: TaskModelRouteParams };

/**
 * Resolves the task and model URL once for the breadcrumb, header, and body so
 * each Suspense region shares identical validation and decoded model data.
 */
const getTaskModelRoute = cache(async (params: TaskModelRouteParams) => {
  const [{ modelId: rawModelId }, { task, taskId }] = await Promise.all([
    params,
    getTaskRoute(params),
  ]);

  const modelId = decodeURIComponent(rawModelId);
  const model = EVAL_MODELS.find((item) => item.id === modelId);

  if (!model) {
    redirect(`/tasks/${taskId}`);
  }

  return { model, modelId, task, taskId };
});

/**
 * Keeps the two URL-dependent breadcrumb positions visible while their task
 * and model labels resolve.
 */
function TaskModelBreadcrumbSkeleton() {
  return (
    <>
      <AppBreadcrumbItemSkeleton className="w-32" />
      <BreadcrumbSeparator />
      <AppBreadcrumbItemSkeleton className="w-24" />
    </>
  );
}

/**
 * Resolves both dynamic labels together so the breadcrumb never mixes task and
 * model names from different route states.
 */
async function TaskModelBreadcrumb({ params }: TaskModelRouteProps) {
  const { model, task } = await getTaskModelRoute(params);

  return (
    <>
      <TaskLinkBreadcrumb taskId={task.id} taskName={task.name} />
      <BreadcrumbSeparator />
      <ModelPageBreadcrumb modelName={getModelDisplayName(model)} />
    </>
  );
}

/**
 * Streams URL-specific task metadata into a focused header boundary while the
 * rest of the model page shell remains available.
 */
async function TaskModelHeader({ params }: TaskModelRouteProps) {
  const { task } = await getTaskModelRoute(params);

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Generate outputs and run evaluations for this task
        </ContainerDescription>
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}

/**
 * Reads results, generated outputs, and progress in parallel because none of
 * those mutable files depends on another to render the model body.
 */
const getTaskModelContent = cache(async (params: TaskModelRouteParams) => {
  const { model, modelId, task, taskId } = await getTaskModelRoute(params);

  const [results, modelOutputs, outputStatus] = await Promise.all([
    getTaskResults(taskId, modelId),
    loadModelOutputs(taskId, modelId),
    getOutputStatus({ modelId, runsPerTestCase: RUNS_PER_TEST_CASE, task }),
  ]);

  const generatedOutputs = modelOutputs
    ? combineOutputsWithTestCases({ modelOutputs, task })
    : null;

  return { generatedOutputs, model, modelId, outputStatus, results, taskId };
});

/**
 * Keeps the guaranteed action card independent from the optional output or
 * result section so its fallback always has a matching resolved element.
 */
async function TaskModelActions({ params }: TaskModelRouteProps) {
  const { generatedOutputs, model, modelId, outputStatus, taskId } =
    await getTaskModelContent(params);

  return (
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
  );
}

/**
 * Avoids guessing whether mutable files will resolve to evaluated results,
 * generated-only outputs, or no secondary section at all.
 */
async function TaskModelResults({ params }: TaskModelRouteProps) {
  const { generatedOutputs, results } = await getTaskModelContent(params);

  if (results) {
    return <EvalResults results={results} />;
  }

  return generatedOutputs && <GeneratedOutputs outputs={generatedOutputs} />;
}

/**
 * Prefetches the stable model-page structure while URL labels and current eval
 * files stream through focused, visible Suspense fallbacks.
 */
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
