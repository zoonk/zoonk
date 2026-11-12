import { AppBreadcrumb, HomePageBreadcrumb } from "@/components/breadcrumb";
import { countScoredModels } from "@/lib/task-results";
import { TASK_GROUPS } from "@/tasks";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import "@zoonk/ui/globals.css";
import Link from "next/link";
import { Suspense } from "react";
import { TaskFinder, type TaskFinderGroup } from "./_components/task-finder";

const GROUPS: TaskFinderGroup[] = TASK_GROUPS.map((group) => ({
  name: group.name,
  tasks: group.tasks.map(({ description, id, name }) => ({ description, id, name })),
}));

async function TaskFinderWithResults() {
  const groups = await Promise.all(
    GROUPS.map(async (group) => ({
      ...group,
      tasks: await Promise.all(
        group.tasks.map(async (task) => ({
          ...task,
          scoredModels: await countScoredModels(task.id),
        })),
      ),
    })),
  );

  return <TaskFinder groups={groups} />;
}

export default function Home() {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomePageBreadcrumb />
      </AppBreadcrumb>

      <ContainerHeader className="items-center">
        <ContainerHeaderGroup>
          <ContainerTitle>Evals</ContainerTitle>
        </ContainerHeaderGroup>

        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/audio-test">
          Audio test
        </Link>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<TaskFinder groups={GROUPS} />}>
          <TaskFinderWithResults />
        </Suspense>
      </ContainerBody>
    </main>
  );
}
