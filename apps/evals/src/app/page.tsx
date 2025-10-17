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
import { TASKS } from "@/tasks";
import "@zoonk/ui/globals.css";
import { buttonVariants } from "@zoonk/ui/components/button";
import { AppBreadcrumb, HomePageBreadcrumb } from "@/patterns/breadcrumb";

export default function Home() {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomePageBreadcrumb />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerTitle>Evals Dashboard</ContainerTitle>
        <ContainerDescription>
          Run and monitor evaluations for AI tasks
        </ContainerDescription>
      </ContainerHeader>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((task) => (
          <Item key={task.id} variant="outline">
            <ItemContent>
              <ItemTitle>{task.name}</ItemTitle>
              <ItemDescription>{task.description}</ItemDescription>
            </ItemContent>

            <ItemActions>
              <Link
                href={`/tasks/${task.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                View Task
              </Link>
            </ItemActions>
          </Item>
        ))}
      </section>
    </main>
  );
}
