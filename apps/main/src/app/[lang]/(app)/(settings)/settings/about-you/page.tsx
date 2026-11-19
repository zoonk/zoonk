import { getAppLocale } from "@/i18n/locale";
import { getProfileQuestions } from "@zoonk/core/profile/questions/get";
import { firstOpenAboutYouQuestion } from "@zoonk/learn/about-you/order";
import { AboutYouQuestionSkeleton } from "@zoonk/learn/about-you/question";
import { Page } from "@zoonk/learn/page";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { AboutYouQuestion } from "./[question]/about-you-question";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t("Your answers shape your examples and your buddy. Everything is optional."),
    robots: { follow: false, index: false },
    title: t("About you"),
  };
}

async function FirstOpenQuestion() {
  const view = await getProfileQuestions({ locale: await getAppLocale() });
  const question = view && firstOpenAboutYouQuestion(view);

  return (
    question && (
      <AboutYouQuestion key={question.id} memoryEnabled={view.memoryEnabled} question={question} />
    )
  );
}

/**
 * The list is the layout's: it stays while a question is open beside it. Before a pick, a wide
 * screen opens the first question still to answer there; a narrow one shows the list alone.
 */
export default function AboutYouPage() {
  return (
    <Page>
      <Suspense fallback={<AboutYouQuestionSkeleton />}>
        <FirstOpenQuestion />
      </Suspense>
    </Page>
  );
}
