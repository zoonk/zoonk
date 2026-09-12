import { Link } from "@/i18n/navigation";
import { parseGenerationReturnTo } from "@/lib/workflow/generation-return-to";
import { getCourseCurriculumGenerationView } from "@zoonk/core/workflows/course-curriculum-generation-access";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CurriculumGenerationClient } from "./curriculum-generation-client";

export const prefetch = "force-disabled";

async function CurriculumContent({
  params,
  searchParams,
}: PageProps<"/[lang]/generate/curriculum/[id]">) {
  const { id } = await params;
  const search = await searchParams;
  const returnTo = parseGenerationReturnTo(search.returnTo);

  const [view, t] = await Promise.all([
    getCourseCurriculumGenerationView({ courseId: id }),
    getExtracted(),
  ]);

  if (view.status === "notFound") {
    notFound();
  }

  if (view.status === "unauthorized") {
    const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    const next = `/generate/curriculum/${id}${query}`;

    return (
      <div className="flex max-w-md flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t("Log in to prepare your course")}</h1>
        <p className="text-muted-foreground">
          {t("Save your learning path and create the chapters you need.")}
        </p>
        <Link className={buttonVariants()} href={`/login?next=${encodeURIComponent(next)}`}>
          {t("Log in")}
        </Link>
      </div>
    );
  }

  return (
    <CurriculumGenerationClient
      brandSlug={view.course.userId ? "me" : "ai"}
      courseId={id}
      courseSlug={view.course.slug}
      courseTitle={view.course.title}
      generationRunId={view.course.generationRunId}
      generationStatus={view.course.generationStatus}
      needsGeneration={view.needsGeneration}
      returnTo={returnTo}
    />
  );
}

export default function CurriculumPage(props: PageProps<"/[lang]/generate/curriculum/[id]">) {
  return (
    <Container variant="narrow">
      <ContainerBody>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <CurriculumContent {...props} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
