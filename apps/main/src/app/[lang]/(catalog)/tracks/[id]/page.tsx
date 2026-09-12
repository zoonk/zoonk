import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUserTrack } from "@zoonk/core/courses/tracks";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackStartButton } from "./track-start-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Your learning track") };
}

async function TrackContent({ params }: Pick<PageProps<"/[lang]/tracks/[id]">, "params">) {
  const { id } = await params;

  const [result, t, locale] = await Promise.all([
    getCurrentUserTrack({ trackId: id }),
    getExtracted(),
    getLocale(),
  ]);

  if (result.status === "unauthorized") {
    return redirect({ href: `/login?next=${encodeURIComponent(`/tracks/${id}`)}`, locale });
  }

  if (result.status !== "ready") {
    notFound();
  }

  const { track } = result;

  const rows = [
    ...track.courses.map((course) => ({ ...course, kind: "course" as const })),
    ...track.pendingCourses.map((course) => ({ ...course, kind: "pending" as const })),
  ].toSorted((a, b) => a.position - b.position);

  const completed =
    track.progress.completedCourses === track.progress.totalCourses &&
    track.progress.totalCourses > 0;

  return (
    <>
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center gap-2 text-sm"
        href="/my"
      >
        <ArrowLeftIcon className="size-4" />
        {t("My Courses")}
      </Link>
      <header className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{t("Learning track")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{track.title}</h1>
        <p className="text-muted-foreground text-sm">
          {t("{count, plural, one {# course} other {# courses}} · {completed, number} completed", {
            completed: track.progress.completedCourses,
            count: track.progress.totalCourses,
          })}
        </p>
      </header>
      {completed ? (
        <p className="text-sm">
          {t(
            "You've finished your selected paths. You can revisit any course or explore it further.",
          )}
        </p>
      ) : (
        <TrackStartButton hasStarted={track.progress.completedLessons > 0} trackId={track.id} />
      )}
      <ol className="divide-border divide-y">
        {rows.map((row, index) => (
          <li key={row.kind === "course" ? row.id : row.coursePromptId}>
            {row.kind === "course" ? (
              <Link
                className="hover:bg-muted focus-visible:ring-ring flex min-h-20 items-center gap-4 rounded-xl px-3 py-4 outline-none focus-visible:ring-2"
                href={`/b/${row.brandSlug}/c/${row.slug}?edition=original`}
              >
                <span className="text-muted-foreground w-5 text-sm tabular-nums">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {row.progress.completedLessons > 0
                      ? t("{count, plural, one {# lesson completed} other {# lessons completed}}", {
                          count: row.progress.completedLessons,
                        })
                      : t("Ready when you are")}
                  </p>
                </div>
                <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
              </Link>
            ) : (
              <div className="flex min-h-20 items-center gap-4 px-3 py-4">
                <span className="text-muted-foreground w-5 text-sm">{index + 1}</span>
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("We'll prepare this course when you reach it.")}
                  </p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4"
        href={`/tracks/${id}/edit`}
      >
        {t("Edit track")}
      </Link>
    </>
  );
}

export default function TrackPage(props: PageProps<"/[lang]/tracks/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6 sm:py-12">
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <TrackContent params={props.params} />
      </Suspense>
    </main>
  );
}
