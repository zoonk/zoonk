import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
  BattlesPageBreadcrumb,
  HomeLinkBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleMatchups } from "@/lib/battle-loader";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRoute } from "../_utils/task-route";
import { BattleMatchupList, BattleMatchupListSkeleton } from "./battle-matchup-list";

type BattlesRouteProps = { params: TaskRouteParams };

/**
 * Streams the task label independently while the Home and Battles breadcrumb
 * items remain available in the shared route shell.
 */
async function BattlesTaskBreadcrumb({ params }: BattlesRouteProps) {
  const { task, taskId } = await getTaskRoute(params);

  return <TaskLinkBreadcrumb taskId={taskId} taskName={task.name} />;
}

/**
 * Reads mutable battle files behind the page body's Suspense boundary so the
 * stable title and navigation never wait on filesystem work.
 */
async function BattleResults({ params }: BattlesRouteProps) {
  const { taskId } = await getTaskRoute(params);
  const matchups = await getBattleMatchups(taskId);

  return <BattleMatchupList matchups={matchups} />;
}

/**
 * Prefetches the stable battles page structure and limits runtime streaming to
 * the URL-dependent task label and its current result list.
 */
export default function BattlesPage({ params }: BattlesRouteProps) {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <Suspense fallback={<AppBreadcrumbItemSkeleton />}>
          <BattlesTaskBreadcrumb params={params} />
        </Suspense>
        <BreadcrumbSeparator />
        <BattlesPageBreadcrumb />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Battle Results</ContainerTitle>
          <ContainerDescription>
            View judge comments and reasoning for each test case
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<BattleMatchupListSkeleton />}>
          <BattleResults params={params} />
        </Suspense>
      </ContainerBody>
    </main>
  );
}
