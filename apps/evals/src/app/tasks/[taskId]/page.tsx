import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
  HomeLinkBreadcrumb,
  TaskPageBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleLeaderboard } from "@/lib/battle-loader";
import { EVAL_MODELS } from "@/lib/models";
import { getModelsWithCompleteOutputs } from "@/lib/output-loader";
import { supportsJudgeMode } from "@/lib/types";
import { getModelsWithResults, getSortedModels } from "@/lib/utils";
import { RUNS_PER_TEST_CASE } from "@/tasks";
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
import { type TaskRouteParams, getTaskRoute } from "./_utils/task-route";
import { runBattleModeAction } from "./actions";
import { LeaderboardTabs, LeaderboardTabsSkeleton } from "./leaderboard-tabs";
import { ModelCard, ModelCardSkeleton } from "./model-card";

type TaskRouteProps = { params: TaskRouteParams };

/**
 * Replaces only the task-dependent breadcrumb item while the shared Home link
 * remains part of the prefetched App Shell.
 */
async function TaskBreadcrumb({ params }: TaskRouteProps) {
  const { task } = await getTaskRoute(params);

  return <TaskPageBreadcrumb taskName={task.name} />;
}

/**
 * Keeps both task actions in place while output files are checked to decide
 * whether Battle Mode is ready to run.
 */
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

/**
 * Loads Battle Mode readiness separately from the task title so filesystem
 * work cannot delay the rest of the header.
 */
async function TaskHeaderActions({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRoute(params);
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

/**
 * Resolves URL-dependent task metadata first, then lets optional action state
 * stream through its own boundary instead of holding back the title.
 */
async function TaskHeader({ params }: TaskRouteProps) {
  const { task } = await getTaskRoute(params);

  const judgeModeSupported = supportsJudgeMode(task);

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Choose a model to run evaluations on {task.testCases.length} test cases (
          {RUNS_PER_TEST_CASE} runs each)
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

/**
 * Reads regular and Battle Mode result files in parallel while the task header
 * and model grid remain independently interactive.
 */
async function TaskLeaderboard({ params }: TaskRouteProps) {
  const { task, taskId } = await getTaskRoute(params);
  const judgeModeSupported = supportsJudgeMode(task);

  const battleEntriesPromise = judgeModeSupported
    ? getBattleLeaderboard(taskId)
    : Promise.resolve([]);

  const [modelsWithResults, battleEntries] = await Promise.all([
    getModelsWithResults(taskId),
    battleEntriesPromise,
  ]);

  return (
    <LeaderboardTabs
      battleEntries={battleEntries}
      results={modelsWithResults}
      supportsJudgeMode={judgeModeSupported}
      taskId={taskId}
    />
  );
}

/**
 * Loads model ordering and status separately because those values come from
 * mutable eval files and should not be frozen into the shared App Shell.
 */
async function TaskModelGrid({ params }: TaskRouteProps) {
  const { taskId } = await getTaskRoute(params);
  const sortedModels = await getSortedModels(taskId);

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedModels.map((model) => (
        <ModelCard key={model.id} model={model} taskId={taskId} />
      ))}
    </section>
  );
}

/**
 * Uses one exact-size placeholder per configured model. Completed models are
 * the only cards the resolved grid can remove, so this preserves the grid's
 * normal row count without maintaining a second model-count constant.
 */
function TaskModelGridSkeleton() {
  return (
    <section aria-hidden="true" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {EVAL_MODELS.map((model) => (
        <ModelCardSkeleton key={model.id} />
      ))}
    </section>
  );
}

/**
 * Keeps stable page structure in the shared App Shell and scopes each runtime
 * read to the smallest region with a useful loading state.
 */
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
