import { getLessonQuestion } from "@/data/questions/get-lesson-question";
import { getAdminLessonLabel } from "@/lib/lesson-label";
import { getAdminQuestionContextLabel, getAdminQuestionStatusVariant } from "@/lib/lesson-question";
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
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { Separator } from "@zoonk/ui/components/separator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestionDetailField } from "./question-detail-field";

function QuestionBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/questions" prefetch />}>Questions</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Details</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function QuestionDetailPage({ params }: PageProps<"/questions/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <QuestionBreadcrumb />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="mx-auto w-full max-w-5xl gap-8">
        <Suspense fallback={<QuestionDetailSkeleton />}>
          <QuestionDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function QuestionDetailContent({ params }: Pick<PageProps<"/questions/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const question = await getLessonQuestion(id);

  if (!question) {
    notFound();
  }

  const { lesson, user } = question.thread;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Question</h1>
          <p className="text-muted-foreground text-sm">
            Asked {question.createdAt.toLocaleString()}
          </p>
        </div>
        <Badge className="capitalize" variant={getAdminQuestionStatusVariant(question.status)}>
          {question.status}
        </Badge>
      </header>

      <section aria-labelledby="question-heading" className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium" id="question-heading">
          Question
        </h2>
        <p className="max-w-3xl text-lg leading-relaxed wrap-break-word whitespace-pre-wrap">
          {question.question}
        </p>
      </section>

      <Separator />

      <section aria-labelledby="answer-heading" className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium" id="answer-heading">
          Answer
        </h2>
        <p className="max-w-3xl leading-7 wrap-break-word whitespace-pre-wrap">
          {question.answer || "No answer is available yet."}
        </p>
      </section>

      <Separator />

      <section aria-labelledby="details-heading" className="flex flex-col">
        <h2 className="mb-2 font-medium" id="details-heading">
          Details
        </h2>
        <dl className="divide-y">
          <QuestionDetailField label="User">
            <Link className="hover:underline" href={`/users/${user.id}`} prefetch>
              {user.name || user.username || "User"}
            </Link>
            <span className="text-muted-foreground block">{user.email}</span>
          </QuestionDetailField>
          <QuestionDetailField label="Course">
            {lesson?.chapter.course.title ?? "Deleted lesson"}
          </QuestionDetailField>
          <QuestionDetailField label="Chapter">{lesson?.chapter.title ?? "—"}</QuestionDetailField>
          <QuestionDetailField label="Lesson">
            {lesson ? getAdminLessonLabel({ kind: lesson.kind, title: lesson.title }) : "—"}
          </QuestionDetailField>
          <QuestionDetailField label="Context">
            {getAdminQuestionContextLabel({
              contextKind: question.contextKind,
              stepNumber: question.stepNumber,
            })}
          </QuestionDetailField>
          <QuestionDetailField label="Model">
            {question.model ?? question.requestedModel ?? "—"}
          </QuestionDetailField>
          <QuestionDetailField label="Provider">{question.provider ?? "—"}</QuestionDetailField>
          <QuestionDetailField label="Input tokens">
            {question.inputTokens?.toLocaleString() ?? "—"}
          </QuestionDetailField>
          <QuestionDetailField label="Output tokens">
            {question.outputTokens?.toLocaleString() ?? "—"}
          </QuestionDetailField>
          <QuestionDetailField label="Finish reason">
            {question.finishReason ?? "—"}
          </QuestionDetailField>
          <QuestionDetailField label="Updated">
            {question.updatedAt.toLocaleString()}
          </QuestionDetailField>
        </dl>
      </section>
    </>
  );
}

function QuestionDetailSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-3/4" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        {["user", "course", "lesson", "model", "updated"].map((field) => (
          <Skeleton className="h-4 w-full" key={field} />
        ))}
      </div>
    </div>
  );
}
