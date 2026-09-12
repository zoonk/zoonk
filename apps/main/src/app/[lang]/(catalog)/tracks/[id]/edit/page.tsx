import { Link, redirect } from "@/i18n/navigation";
import { listCurrentUserCourses } from "@zoonk/core/courses/list-current-user";
import { getCurrentUserTrack } from "@zoonk/core/courses/tracks";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ArrowLeftIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackEditForm } from "./track-edit-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Edit track") };
}

async function EditTrack({ params }: Pick<PageProps<"/[lang]/tracks/[id]/edit">, "params">) {
  const { id } = await params;

  const [result, courses, t, locale] = await Promise.all([
    getCurrentUserTrack({ trackId: id }),
    listCurrentUserCourses(),
    getExtracted(),
    getLocale(),
  ]);

  if (result.status === "unauthorized") {
    return redirect({ href: `/login?next=${encodeURIComponent(`/tracks/${id}/edit`)}`, locale });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <>
      <Link
        className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm"
        href={`/tracks/${id}`}
      >
        <ArrowLeftIcon className="size-4" />
        {t("Back to track")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("Edit track")}</h1>
      <TrackEditForm
        availableCourses={courses.map(({ id: courseId, title }) => ({ id: courseId, title }))}
        track={result.track}
      />
    </>
  );
}

export default function EditTrackPage(props: PageProps<"/[lang]/tracks/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6 sm:py-12">
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <EditTrack params={props.params} />
      </Suspense>
    </main>
  );
}
