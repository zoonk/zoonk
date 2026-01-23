import { AppBreadcrumb, HomeLinkBreadcrumb, TaskPageBreadcrumb } from "@/components/breadcrumb";
import { ModelStatusBadge } from "@/components/model-status-badge";
import { getBattleLeaderboard } from "@/lib/battle-loader";
import { getModelDisplayName } from "@/lib/models";
import { getModelsWithCompleteOutputs } from "@/lib/output-loader";
import { getModelsWithResults, getSortedModels } from "@/lib/utils";
import { RUNS_PER_TEST_CASE, getTaskById } from "@/tasks";
import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { MessageSquareTextIcon, SwordsIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runBattleModeAction } from "./actions";
import { LeaderboardTabs } from "./leaderboard-tabs";

type TaskPageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  const [sortedModels, modelsWithResults, battleEntries, modelsReadyForBattle] = await Promise.all([
    getSortedModels(taskId),
    getModelsWithResults(taskId),
    getBattleLeaderboard(taskId),
    getModelsWithCompleteOutputs(taskId, task.testCases.length),
  ]);

  const canRunBattle = modelsReadyForBattle.length >= 2;

  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskPageBreadcrumb taskName={task.name} />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{task.name}</ContainerTitle>
          <ContainerDescription>
            Choose a model to run evaluations on {task.testCases.length} test cases (
            {RUNS_PER_TEST_CASE} runs each)
          </ContainerDescription>
        </ContainerHeaderGroup>

        <div className="flex items-center gap-2">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/tasks/${taskId}/battles`}
          >
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
      </ContainerHeader>

      <ContainerBody>
        <LeaderboardTabs
          battleEntries={battleEntries}
          results={modelsWithResults}
          taskId={taskId}
        />

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedModels.map((model) => (
            <Item key={model.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  {getModelDisplayName(model)}
                  <ModelStatusBadge modelId={model.id} taskId={taskId} />
                </ItemTitle>
                <ItemDescription>
                  ${model.inputCost}/M input · ${model.outputCost}/M output
                </ItemDescription>
              </ItemContent>

              <ItemActions>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/tasks/${taskId}/${encodeURIComponent(model.id)}`}
                >
                  See Evals
                </Link>
              </ItemActions>
            </Item>
          ))}
        </section>
      </ContainerBody>
    </main>
  );
}
