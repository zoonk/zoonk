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
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "../_utils/task-route";
import { BattleMatchupList, BattleMatchupListSkeleton } from "./battle-matchup-list";

type BattlesRouteProps = { params: TaskRouteParams };

async function BattlesTaskBreadcrumb({ params }: BattlesRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);

  return <TaskLinkBreadcrumb taskId={taskId} taskName={task.name} />;
}

async function BattleResults({ params }: BattlesRouteProps) {
  const { taskId } = await getTaskRouteFromParams(params);
  const matchups = await getBattleMatchups(taskId);

  return <BattleMatchupList matchups={matchups} taskId={taskId} />;
}

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
          <ContainerTitle>Judge comments</ContainerTitle>
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
