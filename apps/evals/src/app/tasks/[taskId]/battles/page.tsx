import {
  AppBreadcrumb,
  BattlesPageBreadcrumb,
  HomeLinkBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleMatchups } from "@/lib/battle-loader";
import { getTaskById } from "@/tasks";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import { BattleMatchupList } from "./battle-matchup-list";

export default async function BattlesPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  const matchups = await getBattleMatchups(taskId);

  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskLinkBreadcrumb taskId={taskId} taskName={task.name} />
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
        <BattleMatchupList matchups={matchups} />
      </ContainerBody>
    </main>
  );
}
