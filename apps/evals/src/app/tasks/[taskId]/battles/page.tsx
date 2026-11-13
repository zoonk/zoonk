import {
  AppBreadcrumb,
  AppBreadcrumbItemSkeleton,
  BattlesPageBreadcrumb,
  HomeLinkBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleMatchups } from "@/lib/battle-loader";
import { PROSE_MEASURE_CLASS } from "@/lib/table-classes";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { type TaskRouteParams, getTaskRouteFromParams } from "../_utils/task-route";
import { BattleMatchupList, BattleMatchupListSkeleton } from "./battle-matchup-list";

type BattlesRouteProps = { params: TaskRouteParams };

export async function generateMetadata({ params }: BattlesRouteProps): Promise<Metadata> {
  const { task } = await getTaskRouteFromParams(params);

  return { title: `Judge comments on ${task.name}` };
}

async function BattlesTaskBreadcrumb({ params }: BattlesRouteProps) {
  const { task, taskId } = await getTaskRouteFromParams(params);

  return (
    <>
      <TaskLinkBreadcrumb taskId={taskId} taskName={task.name} />
      <BreadcrumbSeparator />
      <BattlesPageBreadcrumb />
    </>
  );
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
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Judge comments</ContainerTitle>
          <ContainerDescription className={PROSE_MEASURE_CLASS}>
            Each judge&apos;s average score for a model, out of 10, and what it wrote about every
            test case. A judge never scores its own model family.
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
