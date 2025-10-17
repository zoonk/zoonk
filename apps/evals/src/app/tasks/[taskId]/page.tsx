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
import { getModelStatus, ModelStatusBadge } from "@/blocks/model-status-badge";
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import {
  AppBreadcrumb,
  HomeLinkBreadcrumb,
  TaskPageBreadcrumb,
} from "@/patterns/breadcrumb";
import { getTaskById } from "@/tasks";

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

// Fetch model statuses and sort: notStarted -> incomplete -> completed
async function getSortedModels(taskId: string) {
  const modelWithStatus = await Promise.all(
    EVAL_MODELS.map(async (model) => ({
      model,
      status: await getModelStatus(taskId, model.id),
    })),
  );

  const order: Record<"notStarted" | "incomplete" | "completed", number> = {
    notStarted: 0,
    incomplete: 1,
    completed: 2,
  };

  const sortedModels = modelWithStatus
    .sort((a, b) => order[a.status] - order[b.status])
    .map((x) => x.model);

  return sortedModels;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  const sortedModels = await getSortedModels(taskId);

  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <TaskPageBreadcrumb taskName={task.name} />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Choose a model to run evaluations on {task.testCases.length} test
          cases
        </ContainerDescription>
      </ContainerHeader>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedModels.map((model) => (
          <Item key={model.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {getModelDisplayName(model)}
                <ModelStatusBadge taskId={taskId} modelId={model.id} />
              </ItemTitle>
              <ItemDescription>
                ${model.inputCost}/M input · ${model.outputCost}/M output
              </ItemDescription>
            </ItemContent>

            <ItemActions>
              <Link
                href={`/tasks/${taskId}/${encodeURIComponent(model.id)}`}
                className={buttonVariants({ variant: "outline" })}
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
