import { BreadcrumbSeparator } from "@zoonk/ui/components/breadcrumb";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@zoonk/ui/components/item";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModelStatusBadge } from "@/components/model-status-badge";
import { getModelDisplayName } from "@/lib/models";
import { getModelsWithResults, getSortedModels } from "@/lib/utils";
import {
  AppBreadcrumb,
  HomeLinkBreadcrumb,
  TaskPageBreadcrumb,
} from "@/patterns/breadcrumb";
import { getTaskById, RUNS_PER_TEST_CASE } from "@/tasks";
import { Leaderboard } from "./leaderboard";

type TaskPageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  const sortedModels = await getSortedModels(taskId);
  const modelsWithResults = await getModelsWithResults(taskId);

  return (
    <main className="flex flex-col gap-8">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskPageBreadcrumb taskName={task.name} />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Choose a model to run evaluations on {task.testCases.length} test
          cases ({RUNS_PER_TEST_CASE} runs each)
        </ContainerDescription>
      </ContainerHeader>

      <Leaderboard results={modelsWithResults} taskId={taskId} />

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
    </main>
  );
}
