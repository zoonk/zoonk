import { AuthGatePage } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
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

/**
 * The way back from a chapter opened on a subject's page (`?from=` its key): to that subject, by
 * its name. Anything else goes back to the Plan.
 */
async function loadBack(from: string | string[] | undefined) {
  if (typeof from !== "string" || from.length === 0) {
    return null;
  }

  const result = await getSyllabusView();

  const subject =
    result.status === "ready" ? result.syllabus.subjects.find((item) => item.key === from) : null;

  return subject ? { href: `/plan/${subject.key}`, label: subject.shortName } : null;
}

/**
 * A language goal's chapter is a unit, with one page: the unit's, drawn here too, so a link to it
 * as a chapter never redirects.
 */
async function UnitInPlace({ chapterId, tutor }: { chapterId: string; tutor: TutorViewer }) {
  const [unit, plan] = await Promise.all([getLanguageUnitView({ chapterId }), getPlanTabView()]);

  if (unit.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return (
    <ClientMessagesProvider scope="player">
      <LearnerWitness />
      <UnitScreenClient
        tutor={tutor}
        unit={unit.unit}
        upNext={isCurrentUnit({ chapterId, plan })}
      />
    </ClientMessagesProvider>
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
      <>
        <LearnerWitness />

        <AuthGatePage
          description={t("A chapter of your plan, with its lessons and how far you are.")}
          next={withQuery(`/content/chapters/${chapterId}`, { from })}
          title={t("Chapter")}
        />
      </>
    );
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  if (language.status === "ready") {
    return <UnitInPlace chapterId={chapterId} tutor={tutor} />;
  }

  // The chapter's "Ask" opens the player's questions sheet, so it needs the player's messages.
  return (
    <ClientMessagesProvider scope="player">
      <LearnerWitness />
      <ChapterScreenClient
        back={back}
        chapter={result.chapter}
        mindMap={mindMap.status === "ready" ? mindMap.mindMap : null}
        mindMapCap={allowance && getReachedCap({ allowance, kind: "mindMap" })}
        tutor={tutor}
      />
    </ClientMessagesProvider>
  );
}

/**
 * A chapter of the learner's plan: its lessons with the next one to open, its mistakes and skills,
 * the summaries its lessons left and its test-out. A chapter outside the active goal's plan isn't
 * found; a language goal's chapter opens as its unit.
 */
export default function ChapterPage(props: Props) {
  return (
    <Suspense fallback={<DetailSkeleton rows={4} />}>
      <ChapterBody {...props} />
    </Suspense>
  );
}
