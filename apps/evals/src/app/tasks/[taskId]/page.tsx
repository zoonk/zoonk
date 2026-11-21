import { EVALS_HOME, EvalPageTop, EvalPageTopSkeleton } from "@/components/eval-page-top";
import { formatLatencyBudget } from "@/lib/format";
import { getLeaderboardEntries } from "@/lib/leaderboard";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { getModelsToRun, getModelsWithResults } from "@/lib/utils";
import { RUNS_PER_TEST_CASE } from "@/tasks";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "./_utils/task-route";
import { ComparisonList } from "./comparison-list";
import { Leaderboard } from "./leaderboard";
import { ModelList } from "./model-list";

type TaskRouteProps = { params: TaskRouteParams };

export async function generateMetadata({ params }: TaskRouteProps): Promise<Metadata> {
  const { task } = await getTaskRouteFromParams(params);

  return { title: task.name };
}

function formatTestCases(count: number): string {
  const cases = `${count} ${count === 1 ? "test case" : "test cases"}`;
  const runs: number = RUNS_PER_TEST_CASE;

  return runs === 1 ? cases : `${cases}, ${runs} runs each`;
}

async function TaskHeader({ params }: TaskRouteProps) {
  const { task } = await getTaskRouteFromParams(params);

  return (
    <EvalPageTop parent={EVALS_HOME} title={task.name}>
      <ContainerDescription className={PROSE_MEASURE_CLASS}>
        {task.description}.
      </ContainerDescription>
      <p className="text-muted-foreground font-mono text-xs">
        {formatTestCases(task.testCases.length)}
        {task.latencyBudget && ` · Latency budget: ${formatLatencyBudget(task.latencyBudget)}`}
      </p>
    </EvalPageTop>
  );
}

async function TaskLeaderboard({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);
  const modelsWithResults = await getModelsWithResults(taskId);

  if (modelsWithResults.length === 0) {
    return null;
  }

  return (
    <Leaderboard
      entries={getLeaderboardEntries({ prices: GATEWAY_PRICES, results: modelsWithResults, task })}
      taskId={taskId}
      totalRuns={task.testCases.length * RUNS_PER_TEST_CASE}
    />
  );
}

async function TaskComparisons({ params }: TaskRouteProps) {
  const { taskId } = await getTaskRouteFromParams(params);

  return <ComparisonList taskId={taskId} />;
}

async function TaskModels({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);

  const [models, modelsWithResults] = await Promise.all([
    getModelsToRun(task),
    getModelsWithResults(taskId),
  ]);

  const pricedModels = models.map((item) => ({
    ...item,
    pricing: GATEWAY_PRICES.models[item.model.gatewayModelId],
  }));

  return (
    <ModelList hasResults={modelsWithResults.length > 0} models={pricedModels} taskId={taskId} />
  );
}

export default function TaskPage({ params }: TaskRouteProps) {
  return (
    <main className="flex flex-col gap-4">
      {/* One boundary: the title, the table and the list arrive together, so none pushes another down. */}
      <Suspense fallback={<EvalPageTopSkeleton />}>
        <TaskHeader params={params} />

        <ContainerBody>
          <TaskComparisons params={params} />
          <TaskLeaderboard params={params} />
          <TaskModels params={params} />
        </ContainerBody>
      </Suspense>
    </main>
  );
}
