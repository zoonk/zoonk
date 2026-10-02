import { skipAlphabetAction } from "@/lib/language/skip-alphabet-action";
import { getContentView } from "@zoonk/core/view-models/content/get";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { ContentScreen } from "@zoonk/learn/content";
import { LanguageUnitsList } from "@zoonk/learn/language/units";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Content") };
}

async function ContentBody() {
  const [result, language] = await Promise.all([getContentView(), getLanguageUnitsView()]);

  const units =
    language.status === "ready"
      ? language.units.units.map((unit) => ({
          href: `/content/units/${unit.chapterId}`,
          id: unit.chapterId,
          title: unit.title,
        }))
      : [];

  const alphabet = language.status === "ready" ? language.units.alphabet : null;
  const goalId = language.status === "ready" ? language.units.goalId : null;

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <LearnNoGoal />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <>
      <LanguageUnitsList
        alphabet={
          alphabet && {
            href: `/learn/${alphabet.lessonId}`,
            minutes: alphabet.minutes,
            pending: alphabet.pending,
            title: alphabet.title,
          }
        }
        onSkipAlphabet={skipAlphabetAction.bind(null, goalId)}
        units={units}
      />
      <ContentScreen
        content={result.content}
        hrefs={{ capsules: "/today", chapterBasePath: "/content/chapters", map: "/content/map" }}
      />
    </>
  );
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

/** The goal's skills (Cards in Fun) and the saved lesson summaries. */
export default function ContentPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ContentBody />
    </Suspense>
  );
}
