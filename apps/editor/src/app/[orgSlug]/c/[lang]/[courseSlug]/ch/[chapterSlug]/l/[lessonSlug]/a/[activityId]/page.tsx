import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { BackLink, BackLinkSkeleton } from "@/components/back-link";
import { getLesson } from "@/data/lessons/get-lesson";

type ActivityPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/a/[activityId]">;

async function ActivityBackLink({
  params,
}: {
  params: ActivityPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();
  const { data: lesson } = await getLesson({
    chapterSlug,
    courseSlug,
    language: lang,
    lessonSlug,
    orgSlug,
  });

  const lessonTitle = lesson?.title ?? t("Lesson");

  return (
    <BackLink
      href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`}
    >
      {lessonTitle}
    </BackLink>
  );
}

async function ActivityPlaceholder() {
  const t = await getExtracted();

  return (
    <div className="py-12 text-center text-muted-foreground">
      {t("Activity editor coming soon")}
    </div>
  );
}

export default async function ActivityPage(props: ActivityPageProps) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } =
    await props.params;

  void getLesson({
    chapterSlug,
    courseSlug,
    language: lang,
    lessonSlug,
    orgSlug,
  });

  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <ActivityBackLink params={props.params} />
      </Suspense>

      <ContainerBody>
        <ActivityPlaceholder />
      </ContainerBody>
    </Container>
  );
}
