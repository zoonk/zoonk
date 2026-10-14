import { AuthGatePage } from "@/components/auth-gate";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { getLanguageUnitView } from "@zoonk/core/view-models/language/unit";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isCurrentUnit } from "./current-unit";
import { UnitScreenClient } from "./unit-screen-client";

type Props = PageProps<"/[lang]/content/units/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Unit") };
}

async function UnitBody({ params }: Props) {
  const { chapterId } = await params;

  const [result, tutor, plan] = await Promise.all([
    getLanguageUnitView({ chapterId }),
    getTutorViewer(),
    getPlanTabView(),
  ]);

  if (result.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <AuthGatePage
        description={t("A unit of your language plan, with its lessons and how far you are.")}
        next={`/content/units/${chapterId}`}
        title={t("Unit")}
      />
    );
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <UnitScreenClient
      tutor={tutor}
      unit={result.unit}
      upNext={isCurrentUnit({ chapterId, plan })}
    />
  );
}

/**
 * A language unit's page, one real situation: its grammar tips, words, the learner's mistakes on
 * it and a conversation to practice. Any other chapter isn't a unit, so it's not found.
 */
export default function LanguageUnitPage(props: Props) {
  return (
    <Suspense fallback={<DetailSkeleton rows={4} />}>
      <UnitBody {...props} />
    </Suspense>
  );
}
