import { Container } from "@zoonk/ui/components/container";
import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ContentEditor } from "@/app/[orgSlug]/_components/content-editor";
import { ContentEditorSkeleton } from "@/app/[orgSlug]/_components/content-editor-skeleton";
import { ItemListEditable } from "@/app/[orgSlug]/_components/item-list-editable";
import { ItemListSkeleton } from "@/app/[orgSlug]/_components/item-list-skeleton";
import { SlugEditor } from "@/app/[orgSlug]/_components/slug-editor";
import { SlugEditorSkeleton } from "@/app/[orgSlug]/_components/slug-editor-skeleton";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import {
  checkCourseSlugExists,
  createChapterAction,
  exportChaptersAction,
  importChaptersAction,
  updateCourseDescriptionAction,
  updateCourseSlugAction,
  updateCourseTitleAction,
} from "./actions";

async function CourseContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course, error } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (error || !course) {
    return notFound();
  }

  return (
    <ContentEditor
      descriptionLabel={t("Edit course description")}
      descriptionPlaceholder={t("Course description…")}
      entityId={course.id}
      initialDescription={course.description}
      initialTitle={course.title}
      onSaveDescription={updateCourseDescriptionAction.bind(null, courseSlug)}
      onSaveTitle={updateCourseTitleAction.bind(null, courseSlug)}
      titleLabel={t("Edit course title")}
      titlePlaceholder={t("Course title…")}
    />
  );
}

async function ChapterList({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const [{ data: chapters, error }, { data: course }] = await Promise.all([
    listCourseChapters({ courseSlug, language: lang, orgSlug }),
    getCourse({ courseSlug, language: lang, orgSlug }),
  ]);

  if (error || !course) {
    return (
      <ErrorView
        description={t("We couldn't load the chapters. Please try again.")}
        retryLabel={t("Try again")}
        supportHref={SUPPORT_URL}
        supportLabel={t("Contact support")}
        title={t("Failed to load chapters")}
      />
    );
  }

  const courseId = course.id;

  async function handleInsert(position: number) {
    "use server";
    const { slug, error: createError } = await createChapterAction(
      courseSlug,
      courseId,
      position,
    );

    if (createError) {
      throw new Error(createError);
    }

    if (slug) {
      revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
      redirect(`/${orgSlug}/c/${lang}/${courseSlug}/ch/${slug}`);
    }
  }

  async function handleImport(
    file: File,
    mode: "merge" | "replace",
  ): Promise<{ error: string | null }> {
    "use server";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    const { error: importError } = await importChaptersAction(
      courseSlug,
      courseId,
      formData,
    );

    if (importError) {
      return { error: importError };
    }

    revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
    return { error: null };
  }

  async function handleExport(): Promise<{
    data: object | null;
    error: Error | null;
  }> {
    "use server";
    const { data: exportData, error: exportError } =
      await exportChaptersAction(courseId);

    if (exportError) {
      return { data: null, error: exportError };
    }

    return { data: exportData, error: null };
  }

  return (
    <ItemListEditable
      addLabel={t("Add chapter")}
      cancelLabel={t("Cancel")}
      dropLabel={t("Drop file or click to select")}
      entityType="chapters"
      exportLabel={t("Export")}
      exportSuccessMessage={t("Chapters exported successfully")}
      fileSizeUnit={t("KB")}
      hrefPrefix={`/${orgSlug}/c/${lang}/${courseSlug}/ch/`}
      importDescription={t("Upload a JSON file containing chapters to import.")}
      importLabel={t("Import")}
      importSuccessMessage={t("Chapters imported successfully")}
      importTitle={t("Import chapters")}
      items={chapters}
      modeLabel={t("Import mode")}
      modeMergeLabel={t("Merge (add to existing)")}
      modeReplaceLabel={t("Replace (remove existing first)")}
      moreOptionsLabel={t("More options")}
      onExport={handleExport}
      onImport={handleImport}
      onInsert={handleInsert}
      showFormatLabel={t("Show expected format")}
    />
  );
}

async function CourseSlug({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return null;
  }

  return (
    <SlugEditor
      checkFn={checkCourseSlugExists}
      entityId={course.id}
      initialSlug={course.slug}
      language={lang}
      onSave={updateCourseSlugAction.bind(null, courseSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${lang}/`}
    />
  );
}

export default async function CoursePage(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">,
) {
  const { courseSlug, lang, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getCourse({ courseSlug, language: lang, orgSlug }),
    listCourseChapters({ courseSlug, language: lang, orgSlug }),
  ]);

  return (
    <Container variant="narrow">
      <Suspense fallback={<ContentEditorSkeleton />}>
        <CourseContent params={props.params} />
      </Suspense>

      <Suspense fallback={<SlugEditorSkeleton />}>
        <CourseSlug params={props.params} />
      </Suspense>

      <Suspense fallback={<ItemListSkeleton />}>
        <ChapterList params={props.params} />
      </Suspense>
    </Container>
  );
}
