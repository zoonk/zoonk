import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { getLessonQuestion } from "@/data/questions/get-lesson-question";
import { getAdminQuestionStatusVariant } from "@/lib/lesson-question";
import { Badge } from "@zoonk/ui/components/badge";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { Separator } from "@zoonk/ui/components/separator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestionDetails } from "./question-details";

export const metadata: Metadata = { title: "Question" };

export default function QuestionDetailPage({ params }: PageProps<"/questions/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb
            current="Details"
            parents={[{ href: "/questions", label: "Questions" }]}
          />
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
        <QuestionDetails question={question} />
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
