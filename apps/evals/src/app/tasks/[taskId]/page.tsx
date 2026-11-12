import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
  HomeLinkBreadcrumb,
  TaskPageBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleJudgeCost, getBattleLeaderboard } from "@/lib/battle-loader";
import { formatLatencyBudget } from "@/lib/format";
import { getLeaderboardEntries } from "@/lib/leaderboard";
import { getModelsWithCompleteOutputs } from "@/lib/output-loader";
import { supportsJudgeMode } from "@/lib/types";
import { getModelsToRun, getModelsWithResults } from "@/lib/utils";
import { RUNS_PER_TEST_CASE } from "@/tasks";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import { ButtonSkeleton, buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerHeaderSkeleton,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { MessageSquareTextIcon, SwordsIcon } from "lucide-react";
import { type Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "./_utils/task-route";
import { runBattleModeAction } from "./actions";
import { LeaderboardTabs, LeaderboardTabsSkeleton } from "./leaderboard-tabs";
import { ModelList, ModelListSkeleton } from "./model-list";

type TaskRouteProps = { params: TaskRouteParams };

export async function generateMetadata({ params }: TaskRouteProps): Promise<Metadata> {
  const { task } = await getTaskRouteFromParams(params);

  return { title: task.name };
}

async function TaskBreadcrumb({ params }: TaskRouteProps) {
  const { task } = await getTaskRouteFromParams(params);

  return <TaskPageBreadcrumb taskName={task.name} />;
}

function TaskHeaderActionsSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      <ButtonSkeleton variant="outline">
        <MessageSquareTextIcon />
        Judge comments
      </ButtonSkeleton>
      <ButtonSkeleton>
        <SwordsIcon />
        Run battle
      </ButtonSkeleton>
    </div>
  );
}

async function TaskHeaderActions({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);
  const modelsReadyForBattle = await getModelsWithCompleteOutputs({ runsPerTestCase: 1, task });
  const canRunBattle = modelsReadyForBattle.length >= 2;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      {!canRunBattle && (
        <p className="text-muted-foreground text-xs">A battle needs 2 models with every output.</p>
      )}

      <Link className={buttonVariants({ variant: "outline" })} href={`/tasks/${taskId}/battles`}>
        <MessageSquareTextIcon className="size-4" />
        Judge comments
      </Link>

      <form action={runBattleModeAction}>
        <input name="taskId" type="hidden" value={taskId} />
        <SubmitButton disabled={!canRunBattle} icon={<SwordsIcon />}>
          Run battle
        </SubmitButton>
      </form>
    </div>
  );
}

function formatTestCases(count: number): string {
  const cases = `${count} ${count === 1 ? "test case" : "test cases"}`;
  const runs: number = RUNS_PER_TEST_CASE;

  return runs === 1 ? cases : `${cases}, ${runs} runs each`;
}

async function TaskHeader({ params }: TaskRouteProps) {
  const { task } = await getTaskRouteFromParams(params);

  const judgeModeSupported = supportsJudgeMode(task);

  return (
    <ContainerHeader className="flex-col items-start sm:flex-row sm:items-end">
      <ContainerHeaderGroup>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>{task.description}.</ContainerDescription>
        <p className="text-muted-foreground font-mono text-xs">
          {formatTestCases(task.testCases.length)}
          {task.latencyBudget && ` · Latency budget: ${formatLatencyBudget(task.latencyBudget)}`}
        </p>
      </ContainerHeaderGroup>

      {judgeModeSupported && (
        <Suspense fallback={<TaskHeaderActionsSkeleton />}>
          <TaskHeaderActions params={params} />
        </Suspense>
      )}
    </ContainerHeader>
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

  return <ModelList models={models} open={modelsWithResults.length === 0} taskId={taskId} />;
}

export default function TaskPage({ params }: TaskRouteProps) {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <Suspense fallback={<AppBreadcrumbItemSkeleton />}>
          <TaskBreadcrumb params={params} />
        </Suspense>
      </AppBreadcrumb>

      <Suspense fallback={<ContainerHeaderSkeleton />}>
        <TaskHeader params={params} />
      </Suspense>

      <ContainerBody>
        <Suspense fallback={<LeaderboardTabsSkeleton />}>
          <TaskLeaderboard params={params} />
        </Suspense>

        <Suspense fallback={<ModelListSkeleton />}>
          <TaskModels params={params} />
        </Suspense>
      </ContainerBody>
    </main>
  );
}
