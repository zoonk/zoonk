import {
  AdminEditFormSkeleton,
  AdminEditFormSkeletonActions,
  AdminEditFormSkeletonField,
} from "@/components/admin-edit-form";
import { getCoursePrompt } from "@/data/course-prompts/get-course-prompt";
import { CourseFormat, CoursePromptIntent } from "@zoonk/db";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoursePromptForm } from "./course-prompt-form";

export const metadata: Metadata = { title: "Edit Course Prompt" };
export const prefetch = "allow-runtime";

/**
 * The list remains one click away while the current breadcrumb clearly marks
 * this route as an editor rather than another prompt detail log.
 */
function CoursePromptBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/course-prompts">Course Prompts</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Edit</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * The static edit shell renders immediately while the private prompt record is
 * validated and loaded inside its Suspense boundary.
 */
export default function CoursePromptEditPage({ params }: PageProps<"/course-prompts/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <CoursePromptBreadcrumb />
          <ContainerTitle>Edit course prompt</ContainerTitle>
          <ContainerDescription>
            Correct its routing classification and generation eligibility.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<CoursePromptFormSkeleton />}>
          <CoursePromptFormContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/**
 * Invalid identifiers and deleted prompts use the standard not-found boundary
 * before any values are passed to the client-side form.
 */
async function CoursePromptFormContent({
  params,
}: Pick<PageProps<"/course-prompts/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const prompt = await getCoursePrompt(id);

  if (!prompt) {
    notFound();
  }

  return (
    <CoursePromptForm
      courseFormats={Object.values(CourseFormat)}
      intents={Object.values(CoursePromptIntent)}
      prompt={{
        canonicalTitle: prompt.canonicalTitle,
        courseFormat: prompt.courseFormat,
        generationStatus: prompt.generationStatus,
        id: prompt.id,
        intent: prompt.intent,
        language: prompt.language,
        prompt: prompt.prompt,
      }}
    />
  );
}

/**
 * Four field placeholders mirror intent, format, title, and generation status
 * while the selected prompt is loading.
 */
function CoursePromptFormSkeleton() {
  return (
    <AdminEditFormSkeleton>
      <div className="border-b pb-6">
        <Skeleton className="mb-2 h-4 w-28" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-3 w-8" />
      </div>
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonActions />
    </AdminEditFormSkeleton>
  );
}
