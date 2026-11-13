import { EvalPageTop, EvalPageTopSkeleton } from "@/components/eval-page-top";
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
import { ContainerBody } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { getTaskRoute } from "../_utils/task-route";
import { EvalResults } from "./eval-results";
import { TaskModelFileActions, TaskModelReasoning, TaskModelRunBar } from "./task-model-actions";

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

export async function generateMetadata({ params }: TaskModelRouteProps): Promise<Metadata> {
  const { model, task } = await getTaskModelRouteFromParams(params);

  return { title: `${getModelDisplayName(model)} on ${task.name}` };
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

function getExportEntries({
  generatedOutputs,
  results,
}: Awaited<ReturnType<typeof getTaskModelContent>>) {
  return (
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
  );
}

async function TaskModelHeader({ params }: TaskModelRouteProps) {
  const content = await getTaskModelContentFromParams(params);
  const { generatedOutputs, model, modelId, outputStatus, results, taskId, taskName } = content;

  return (
    <EvalPageTop
      actions={
        <TaskModelFileActions
          exportEntries={getExportEntries(content)}
          failedRuns={results?.failedRuns ?? []}
          modelId={modelId}
          reviewEntries={createReviewExportEntries({
            outputs: generatedOutputs?.outputs ?? [],
            results: results?.results ?? [],
          })}
          summary={getSummary(content)}
          taskId={taskId}
          taskName={taskName}
        />
      }
      parent={{ href: `/tasks/${taskId}`, label: taskName }}
      title={`${getModelDisplayName(model)} on ${taskName}`}
    >
      <p className="text-muted-foreground font-mono text-xs">
        {outputStatus.completedOutputs} of {outputStatus.totalOutputs} outputs written ·{" "}
        {results?.results.length ?? 0} scored
      </p>
    </EvalPageTop>
  );
}

function getSummary({ results }: Awaited<ReturnType<typeof getTaskModelContent>>) {
  return aggregateEvalResults(results ?? { outputs: [], results: [] });
}

async function TaskModelSettings({ params }: TaskModelRouteProps) {
  const { model } = await getTaskModelContentFromParams(params);

  return <TaskModelReasoning model={model} />;
}

async function TaskModelRun({ params }: TaskModelRouteProps) {
  const content = await getTaskModelContentFromParams(params);

  return (
    <TaskModelRunBar
      model={content.model}
      modelId={content.modelId}
      outputStatus={content.outputStatus}
      summary={getSummary(content)}
      taskId={content.taskId}
    />
  );
}

async function TaskModelResults({ params }: TaskModelRouteProps) {
  const { generatedOutputs, results } = await getTaskModelContentFromParams(params);

  if (results && generatedOutputs) {
    return <EvalResults outputs={generatedOutputs} results={results} />;
  }

  return null;
}

export default function TaskModelPage({ params }: TaskModelRouteProps) {
  return (
    <main className="flex min-h-dvh flex-col gap-4">
      {/* One boundary: every part reads the same results, so they arrive together and none pushes another. */}
      <Suspense fallback={<EvalPageTopSkeleton />}>
        <TaskModelHeader params={params} />

        <ContainerBody className="sm:flex-1">
          <div className="flex flex-1 flex-col gap-4">
            <TaskModelSettings params={params} />
            <TaskModelResults params={params} />
          </div>
          <TaskModelRun params={params} />
        </ContainerBody>
      </Suspense>
    </main>
  );
}
