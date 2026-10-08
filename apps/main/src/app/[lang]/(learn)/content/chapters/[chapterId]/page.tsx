import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { redirect } from "@/i18n/navigation";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { getChapterMindMap } from "@zoonk/core/mind-maps/get-chapter";
import { getChapterView } from "@zoonk/core/view-models/chapter/get";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterScreenClient } from "./chapter-screen-client";

type Props = PageProps<"/[lang]/content/chapters/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Chapter") };
}

/**
 * The way back from a chapter opened on a subject's page (`?from=` its key): to that subject, by
 * its name. Anything else goes back to the Journey.
 */
async function loadBack(from: string | string[] | undefined) {
  if (typeof from !== "string" || from.length === 0) {
    return null;
  }

  const result = await getSyllabusView();

  const subject =
    result.status === "ready" ? result.syllabus.subjects.find((item) => item.key === from) : null;

  return subject ? { href: `/journey/${subject.key}`, label: subject.shortName } : null;
}

async function ChapterBody({ params, searchParams }: Props) {
  const [{ chapterId, lang }, { from }] = await Promise.all([params, searchParams]);

  const [result, tutor, language, back, mindMap] = await Promise.all([
    getChapterView({ chapterId }),
    getTutorViewer(),
    getLanguageUnitsView(),
    loadBack(from),
    getChapterMindMap({ chapterId }),
  ]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  // A language goal's chapter is a unit, with one page: the unit's.
  if (language.status === "ready") {
    redirect({ href: `/content/units/${chapterId}`, locale: lang });
  }

  // The chapter's "Ask" opens the player's questions sheet, so it needs the player's messages.
  return (
    <ClientMessagesProvider scope="player">
      <ChapterScreenClient
        back={back}
        chapter={result.chapter}
        mindMap={mindMap.status === "ready" ? mindMap.mindMap : null}
        tutor={tutor}
      />
    </ClientMessagesProvider>
  );
}

function ChapterSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <JourneyPageBar />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-3xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

/**
 * A chapter of the learner's plan: its lessons with the next one to open, its mistakes and skills,
 * the summaries its lessons left and its test-out. A chapter outside the active goal's plan isn't
 * found; a language goal's chapter opens as its unit.
 */
export default function ChapterPage(props: Props) {
  return (
    <Suspense fallback={<ChapterSkeleton />}>
      <ChapterBody {...props} />
    </Suspense>
  );
}
