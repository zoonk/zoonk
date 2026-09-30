import { redirect } from "@/i18n/navigation";
import { getLanguageUnitView } from "@zoonk/core/view-models/language/unit";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UnitScreenClient } from "./unit-screen-client";

type Props = PageProps<"/[lang]/content/units/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Unit") };
}

async function UnitBody({ params }: Props) {
  const { chapterId, lang } = await params;
  const result = await getLanguageUnitView({ chapterId });

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return <UnitScreenClient unit={result.unit} />;
}

function UnitSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-24 rounded-full" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-3xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-24 w-full rounded-3xl" />
      <Skeleton className="h-32 w-full rounded-3xl" />
    </div>
  );
}

/**
 * A language unit's page, one real situation: its grammar tips, words, the learner's mistakes on
 * it and a conversation to practice. Any other chapter isn't a unit, so it's not found.
 */
export default function LanguageUnitPage(props: Props) {
  return (
    <Suspense fallback={<UnitSkeleton />}>
      <UnitBody {...props} />
    </Suspense>
  );
}
