import {
  ContainerBody,
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

      <ContainerBody className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Image Test</ItemTitle>
            <ItemDescription>
              Test AI-generated course thumbnails
            </ItemDescription>
          </ItemContent>

          <ItemActions>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/image-test"
            >
              Test Images
            </Link>
          </ItemActions>
        </Item>

        {TASKS.map((task) => (
          <Item key={task.id} variant="outline">
            <ItemContent>
              <ItemTitle>{task.name}</ItemTitle>
              <ItemDescription>{task.description}</ItemDescription>
            </ItemContent>

            <ItemActions>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/tasks/${task.id}`}
              >
                View Task
              </Link>
            </ItemActions>
          </Item>
        ))}
      </ContainerBody>
    </main>
  );
}
