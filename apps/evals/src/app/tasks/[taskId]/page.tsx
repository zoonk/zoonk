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
import { EVAL_MODELS, getModelDisplayName } from "@/lib/models";
import { TASKS } from "@/tasks";

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params;
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-4">
      <ContainerHeader>
        <ContainerTitle>{task.name}</ContainerTitle>
        <ContainerDescription>
          Choose a model to run evaluations on {task.testCases.length} test
          cases
        </ContainerDescription>
      </ContainerHeader>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {EVAL_MODELS.map((model) => (
          <Item key={model.id} variant="outline">
            <ItemContent>
              <ItemTitle>{getModelDisplayName(model)}</ItemTitle>
              <ItemDescription>
                ${model.inputCost}/M input · ${model.outputCost}/M output
              </ItemDescription>
            </ItemContent>

            <ItemActions>
              <Link
                href={`/tasks/${taskId}/${encodeURIComponent(model.id)}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Run Eval
              </Link>
            </ItemActions>
          </Item>
        ))}
      </section>
    </main>
  );
}
