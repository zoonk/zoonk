import { AppBreadcrumb, HomePageBreadcrumb } from "@/components/breadcrumb";
import { TASKS } from "@/tasks";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import "@zoonk/ui/globals.css";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@zoonk/ui/components/item";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomePageBreadcrumb />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Evals Dashboard</ContainerTitle>
          <ContainerDescription>Run and monitor evaluations for AI tasks</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Image Test</ItemTitle>
            <ItemDescription>Test AI-generated course thumbnails</ItemDescription>
          </ItemContent>

          <ItemActions>
            <Link className={buttonVariants({ variant: "outline" })} href="/image-test">
              Test Images
            </Link>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Select Image Test</ItemTitle>
            <ItemDescription>Test AI-generated images for selectImage quiz steps</ItemDescription>
          </ItemContent>

          <ItemActions>
            <Link className={buttonVariants({ variant: "outline" })} href="/select-image-test">
              Test Images
            </Link>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Visual Image Test</ItemTitle>
            <ItemDescription>Test AI-generated images for step visual resources</ItemDescription>
          </ItemContent>

          <ItemActions>
            <Link className={buttonVariants({ variant: "outline" })} href="/visual-image-test">
              Test Images
            </Link>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Audio Test</ItemTitle>
            <ItemDescription>Test AI-generated audio for words and sentences</ItemDescription>
          </ItemContent>

          <ItemActions>
            <Link className={buttonVariants({ variant: "outline" })} href="/audio-test">
              Test Audio
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
              <Link className={buttonVariants({ variant: "outline" })} href={`/tasks/${task.id}`}>
                View Task
              </Link>
            </ItemActions>
          </Item>
        ))}
      </ContainerBody>
    </main>
  );
}
