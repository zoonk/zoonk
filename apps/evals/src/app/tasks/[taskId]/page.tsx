import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
  HomeLinkBreadcrumb,
  TaskPageBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleJudgeCost, getBattleLeaderboard } from "@/lib/battle-loader";
import { formatLatencyBudget } from "@/lib/format";
import { getLeaderboardEntries } from "@/lib/leaderboard";
import { EVAL_MODELS } from "@/lib/models";
import { getModelsWithCompleteOutputs } from "@/lib/output-loader";
import { supportsJudgeMode } from "@/lib/types";
import { getModelsWithResults, getSortedModels } from "@/lib/utils";
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
import Link from "next/link";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "./_utils/task-route";
import { runBattleModeAction } from "./actions";
import { LeaderboardTabs, LeaderboardTabsSkeleton } from "./leaderboard-tabs";
import { ModelCard, ModelCardSkeleton } from "./model-card";

type TaskRouteProps = { params: TaskRouteParams };

async function TaskBreadcrumb({ params }: TaskRouteProps) {
  const { task } = await getTaskRouteFromParams(params);

  return <TaskPageBreadcrumb taskName={task.name} />;
}

function TaskHeaderActionsSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      <ButtonSkeleton variant="outline">
        <MessageSquareTextIcon />
        View Judge Comments
      </ButtonSkeleton>
      <ButtonSkeleton>
        <SwordsIcon />
        Run Battle Mode
      </ButtonSkeleton>
    </div>
  );
}

async function TaskHeaderActions({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);
  const modelsReadyForBattle = await getModelsWithCompleteOutputs({ runsPerTestCase: 1, task });
  const canRunBattle = modelsReadyForBattle.length >= 2;

  return (
    <div className="flex items-center gap-2">
      <Link className={buttonVariants({ variant: "outline" })} href={`/tasks/${taskId}/battles`}>
        <MessageSquareTextIcon className="size-4" />
        View Judge Comments
      </Link>

      <form action={runBattleModeAction}>
        <input name="taskId" type="hidden" value={taskId} />
        <SubmitButton disabled={!canRunBattle} icon={<SwordsIcon />}>
          Run Battle Mode
        </SubmitButton>
      </form>
    </div>
  );
}

async function TaskHeader({ params }: TaskRouteProps) {
  const { task } = await getTaskRouteFromParams(params);

  const judgeModeSupported = supportsJudgeMode(task);

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Choose a model to run evaluations on {task.testCases.length} test cases (
          {RUNS_PER_TEST_CASE} runs each)
          {task.latencyBudget && `. Latency budget: ${formatLatencyBudget(task.latencyBudget)}`}
        </ContainerDescription>
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
    />
  );
}

async function TaskModelGrid({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);
  const sortedModels = await getSortedModels(task);

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedModels.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          pricing={GATEWAY_PRICES.models[model.gatewayModelId]}
          taskId={taskId}
        />
      ))}
    </section>
  );
}

function TaskModelGridSkeleton() {
  return (
    <section aria-hidden="true" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {EVAL_MODELS.map((model) => (
        <ModelCardSkeleton key={model.id} />
      ))}
    </section>
  );
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

        <Suspense fallback={<TaskModelGridSkeleton />}>
          <TaskModelGrid params={params} />
        </Suspense>
      </ContainerBody>
    </main>
  );
}
