import { getAppLocale } from "@/i18n/locale";
import {
  PROFILE_QUESTIONS,
  isBiographyQuestion,
  isProfileQuestion,
} from "@zoonk/core/profile/questions/contract";
import { getProfileQuestions } from "@zoonk/core/profile/questions/get";
import { Page } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProtectedSection } from "../../../_components/protected-section";
import { AboutYouQuestion } from "./about-you-question";

type Props = PageProps<"/[lang]/settings/about-you/[question]">;

/** The questions are a closed set, so their pages prerender with the Settings frame. */
export function generateStaticParams() {
  return PROFILE_QUESTIONS.map((question) => ({ question }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("About you") };
}

async function QuestionContent({ params }: Props) {
  const { question: id } = await params;

  if (!isProfileQuestion(id)) {
    notFound();
  }

  const view = await getProfileQuestions({ locale: await getAppLocale() });
  const question = view?.questions.find((item) => item.id === id);
  // With memory off, only how they learn can change: the rest would write memory.
  if (view && (!question || (!view.memoryEnabled && isBiographyQuestion(id)))) {
    notFound();
  }

  return (
    <ProtectedSection allowGuests next={`/settings/about-you/${id}`}>
      {view && question && (
        <AboutYouQuestion key={id} memoryEnabled={view.memoryEnabled} question={question} />
      )}
    </ProtectedSection>
  );
}

function QuestionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

export default function AboutYouQuestionPage(props: Props) {
  return (
    <Page className="max-w-form flex-1">
      <Suspense fallback={<QuestionSkeleton />}>
        <QuestionContent {...props} />
      </Suspense>
    </Page>
  );
}
