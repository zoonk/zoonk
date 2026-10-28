import { AuthGatePage } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { withQuery } from "@/lib/with-query";
import { getReachedCap } from "@zoonk/core/entitlements/contract";
import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { getChapterMindMap } from "@zoonk/core/mind-maps/get-chapter";
import { getChapterView } from "@zoonk/core/view-models/chapter/get";
import { getLanguageUnitView } from "@zoonk/core/view-models/language/unit";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNotFound } from "../../../_components/learn-not-found";
import { isCurrentUnit } from "../../units/[chapterId]/current-unit";
import { UnitScreenClient } from "../../units/[chapterId]/unit-screen-client";
import { ChapterScreenClient } from "./chapter-screen-client";

type Props = PageProps<"/[lang]/content/chapters/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Chapter") };
}

async function loadBack(from: string | string[] | undefined) {
  if (typeof from !== "string" || from.length === 0) {
    return null;
  }

  const result = await getSyllabusView();

  const subject =
    result.status === "ready" ? result.syllabus.subjects.find((item) => item.key === from) : null;

  return subject ? { href: `/plan/${subject.key}`, label: subject.shortName } : null;
}

/** Drawn here too, so a link to a unit as a chapter never redirects. */
async function UnitInPlace({ chapterId, tutor }: { chapterId: string; tutor: TutorViewer }) {
  const [unit, plan] = await Promise.all([getLanguageUnitView({ chapterId }), getPlanTabView()]);

  if (unit.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return (
    <UnitScreenClient tutor={tutor} unit={unit.unit} upNext={isCurrentUnit({ chapterId, plan })} />
  );
}

async function ChapterBody({ params, searchParams }: Props) {
  const [{ chapterId }, { from }] = await Promise.all([params, searchParams]);

  const [result, tutor, language, back, mindMap, allowance] = await Promise.all([
    getChapterView({ chapterId }),
    getTutorViewer(),
    getLanguageUnitsView(),
    loadBack(from),
    getChapterMindMap({ chapterId }),
    getAllowance(),
  ]);

  if (result.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <AuthGatePage
        description={t("A chapter of your plan, with its lessons and how far you are.")}
        next={withQuery(`/content/chapters/${chapterId}`, { from })}
        title={t("Chapter")}
      />
    );
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  if (language.status === "ready") {
    return <UnitInPlace chapterId={chapterId} tutor={tutor} />;
  }

  return (
    <ChapterScreenClient
      back={back}
      chapter={result.chapter}
      mindMap={mindMap.status === "ready" ? mindMap.mindMap : null}
      mindMapCap={allowance && getReachedCap({ allowance, kind: "mindMap" })}
      tutor={tutor}
    />
  );
}

export default function ChapterPage(props: Props) {
  return (
    <Suspense fallback={<DetailSkeleton rows={4} />}>
      <ChapterBody {...props} />
    </Suspense>
  );
}
