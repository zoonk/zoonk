import { EVALS_HOME, EvalPageTop, EvalPageTopSkeleton } from "@/components/eval-page-top";
import { getBattleJudgeCost, getBattleLeaderboard } from "@/lib/battle-loader";
import { formatLatencyBudget } from "@/lib/format";
import { getLeaderboardEntries } from "@/lib/leaderboard";
import { getModelsWithCompleteOutputs } from "@/lib/output-loader";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { supportsJudgeMode } from "@/lib/types";
import { getModelsToRun, getModelsWithResults } from "@/lib/utils";
import { RUNS_PER_TEST_CASE } from "@/tasks";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { type Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "./_utils/task-route";
import { runBattleModeAction } from "./actions";
import { LeaderboardTabs } from "./leaderboard-tabs";
import { ModelList } from "./model-list";

type TaskRouteProps = { params: TaskRouteParams };

export async function generateMetadata({ params }: TaskRouteProps): Promise<Metadata> {
  const { task } = await getTaskRouteFromParams(params);

  return { title: task.name };
}

function TaskHeaderActions({ canRunBattle, taskId }: { canRunBattle: boolean; taskId: string }) {
  return (
    <>
      <Link
        className={buttonVariants({ size: "bar", variant: "outline" })}
        href={`/tasks/${taskId}/battles`}
      >
        Judge comments
      </Link>

      <form action={runBattleModeAction}>
        <input name="taskId" type="hidden" value={taskId} />
        <SubmitButton disabled={!canRunBattle} size="bar" variant="outline">
          Run battle
        </SubmitButton>
      </form>
    </>
  );
}

function formatTestCases(count: number): string {
  const cases = `${count} ${count === 1 ? "test case" : "test cases"}`;
  const runs: number = RUNS_PER_TEST_CASE;

  return runs === 1 ? cases : `${cases}, ${runs} runs each`;
}

async function TaskHeader({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);
  const judgeModeSupported = supportsJudgeMode(task);

  const modelsReadyForBattle = judgeModeSupported
    ? await getModelsWithCompleteOutputs({ runsPerTestCase: 1, task })
    : [];

  const canRunBattle = modelsReadyForBattle.length >= 2;

  return (
    <EvalPageTop
      actions={
        judgeModeSupported && <TaskHeaderActions canRunBattle={canRunBattle} taskId={taskId} />
      }
      parent={EVALS_HOME}
      title={task.name}
    >
      <ContainerDescription className={PROSE_MEASURE_CLASS}>
        {task.description}.
      </ContainerDescription>
      <p className="text-muted-foreground font-mono text-xs">
        {formatTestCases(task.testCases.length)}
        {task.latencyBudget && ` · Latency budget: ${formatLatencyBudget(task.latencyBudget)}`}
      </p>
      {judgeModeSupported && !canRunBattle && (
        <p className="text-muted-foreground text-xs">
          Run battle needs 2 models with every output.
        </p>
      )}
    </EvalPageTop>
  );
}

async function TaskLeaderboard({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);
  const judgeModeSupported = supportsJudgeMode(task);

  const [modelsWithResults, battleEntries, battleJudgeCost] = await Promise.all([
    getModelsWithResults(taskId),
    judgeModeSupported ? getBattleLeaderboard(taskId) : [],
    judgeModeSupported ? getBattleJudgeCost(taskId) : 0,
  ]);

  return (
    <LeaderboardTabs
      battleEntries={battleEntries}
      battleJudgeCost={battleJudgeCost}
      entries={getLeaderboardEntries({ prices: GATEWAY_PRICES, results: modelsWithResults, task })}
      supportsJudgeMode={judgeModeSupported}
      taskId={taskId}
      totalRuns={task.testCases.length * RUNS_PER_TEST_CASE}
    />
  );
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
          <TaskLeaderboard params={params} />
          <TaskModels params={params} />
        </ContainerBody>
      </Suspense>
    </main>
  );
}
