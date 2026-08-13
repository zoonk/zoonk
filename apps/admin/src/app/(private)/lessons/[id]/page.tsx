import { getGeneratedLessonAudio } from "@/data/lessons/get-generated-lesson-audio";
import { getAdminLessonLabel } from "@/lib/lesson-label";
import { Badge } from "@zoonk/ui/components/badge";
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { isUuid } from "@zoonk/utils/uuid";
import { CircleCheckIcon } from "lucide-react";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AudioUploadForm } from "./audio-upload-form";

export const metadata: Metadata = { title: "Lesson Audio" };

/** Keeps the global missing audio queue one click away from the repair page. */
function LessonAudioBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/lessons?status=missingAudio">Missing audio</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Audio</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * The static shell explains the repair task while private lesson resources
 * stream into the content area below it.
 */
export default function LessonAudioPage({ params }: PageProps<"/lessons/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <LessonAudioBreadcrumb />
          <ContainerTitle>Lesson audio</ContainerTitle>
          <ContainerDescription>
            Upload a clip for any generated symbol, word, or sentence that is missing audio.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<LessonAudioSkeleton />}>
          <LessonAudioContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/**
 * Invalid or deleted lesson identifiers use the standard not-found boundary
 * before the audio resource query reaches Prisma.
 */
async function LessonAudioContent({ params }: Pick<PageProps<"/lessons/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const result = await getGeneratedLessonAudio(id);

  if (!result) {
    notFound();
  }

  const lessonTitle = getAdminLessonLabel({ kind: result.lesson.kind, title: result.lesson.title });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="border-b pb-5">
        <h2 className="font-medium">{lessonTitle}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.lesson.course.title} · {result.lesson.chapter.title}
        </p>
      </div>

      {result.missingAudio.length === 0 ? (
        <EmptyView
          description="Every saved symbol, word, and sentence for this lesson already has audio."
          icon={CircleCheckIcon}
          title="Audio is complete"
        />
      ) : (
        <ItemGroup className="divide-y">
          {result.missingAudio.map((resource) => (
            <Item className="rounded-none px-0" key={`${resource.kind}:${resource.id}`}>
              <ItemContent>
                <ItemTitle>
                  {resource.text}
                  <Badge className="capitalize" variant="outline">
                    {resource.kind}
                  </Badge>
                </ItemTitle>
                <ItemDescription>No generated audio is available.</ItemDescription>
              </ItemContent>
              <ItemActions>
                <AudioUploadForm lessonId={result.lesson.id} resource={resource} />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

/** Keeps the lesson identity and first repair rows stable while data loads. */
function LessonAudioSkeleton() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="border-b pb-5">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>
    </div>
  );
}
