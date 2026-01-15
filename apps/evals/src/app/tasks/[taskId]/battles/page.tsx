import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppBreadcrumb,
  BattlesPageBreadcrumb,
  HomeLinkBreadcrumb,
  TaskLinkBreadcrumb,
} from "@/components/breadcrumb";
import { getBattleMatchups } from "@/lib/battle-loader";
import { getTaskById } from "@/tasks";

type BattlesPageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function BattlesPage({ params }: BattlesPageProps) {
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
        {matchups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No battle results yet. Run Battle Mode first.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {matchups.map((matchup) => (
              <Link
                className="flex flex-col gap-2 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20"
                href={`/tasks/${taskId}/battles/${matchup.testCaseId}`}
                key={matchup.testCaseId}
              >
                <h2 className="font-semibold">{matchup.testCaseId}</h2>
                <p className="text-muted-foreground text-sm">
                  {matchup.judgments.length} judge(s) •{" "}
                  {matchup.judgments[0]?.rankings.length ?? 0} models ranked
                </p>
              </Link>
            ))}
          </div>
        )}
      </ContainerBody>
    </main>
  );
}
