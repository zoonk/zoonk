import { AuthGateScreen } from "@/components/auth-gate";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { Link } from "@/i18n/navigation";
import { type EarlierQuestion, listEarlierQuestions } from "@zoonk/core/lesson-questions/earlier";
import { LearnPageBar } from "@zoonk/learn/bar";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { LessonQuestionMarkdown } from "@zoonk/player/tutor/markdown";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Earlier questions") };
}

/**
 * One question as the learner asked it, under the course it came from. The lesson it was about is
 * gone, so nothing links anywhere: it's history to read.
 */
async function EarlierQuestionEntry({ question }: { question: EarlierQuestion }) {
  const t = await getExtracted();

  return (
    <li className="flex flex-col gap-2 py-5 first:pt-0">
      <p className="text-muted-foreground text-xs">
        {question.courseTitle
          ? t("From an earlier version of {course}", { course: question.courseTitle })
          : t("From an earlier version of this course")}
        {question.lessonTitle && ` · ${question.lessonTitle}`}
      </p>

      <p className="font-medium text-pretty">{question.question}</p>

      {question.answer ? (
        <div className="text-[0.9375rem] leading-relaxed">
          <LessonQuestionMarkdown
            answer={question.answer}
            isAnimating={false}
            isStreaming={false}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("No answer was saved.")}</p>
      )}
    </li>
  );
}

type Props = PageProps<"/[lang]/buddy/earlier-questions">;

async function EarlierQuestionsContent({ searchParams }: Pick<Props, "searchParams">) {
  const { cursor } = await searchParams;

  const result = await listEarlierQuestions({
    cursor: typeof cursor === "string" ? cursor : undefined,
  });

  if (result.status === "unauthorized") {
    return <AuthGateScreen next="/buddy/earlier-questions" />;
  }

  if (result.status === "invalidCursor") {
    notFound();
  }

  const t = await getExtracted();

  return (
    <>
      <LearnPageBar back={{ href: "/buddy" }} title={t("Earlier questions")} />

      <Page>
        <PageHeader>
          <PageHeaderContent>
            <PageTitle>{t("Earlier questions")}</PageTitle>
            <PageSubtitle>
              {t(
                "What you asked in your courses before we rewrote them. The lessons changed, so your questions stay here to reread.",
              )}
            </PageSubtitle>
          </PageHeaderContent>
        </PageHeader>

        {result.questions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("You have no earlier questions.")}</p>
        ) : (
          // The tutor's answers link out through the player's confirmation dialog.
          <ClientMessagesProvider scope="player">
            <ol className="divide-border max-w-column flex flex-col divide-y">
              {result.questions.map((question) => (
                <EarlierQuestionEntry key={question.id} question={question} />
              ))}
            </ol>
          </ClientMessagesProvider>
        )}

        {result.nextCursor && (
          <Link
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center self-start rounded-md text-sm transition-colors outline-none focus-visible:ring-[3px]"
            href={`/buddy/earlier-questions?cursor=${encodeURIComponent(result.nextCursor)}`}
          >
            {t("Older questions")}
          </Link>
        )}
      </Page>
    </>
  );
}

function EarlierQuestionsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="h-4 w-full max-w-96" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * The questions a learner asked about lessons from an earlier version of their courses, reached
 * from the buddy's menu: kept, so a rewrite never reads as their history deleted.
 */
export default function EarlierQuestionsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<EarlierQuestionsSkeleton />}>
      <EarlierQuestionsContent searchParams={searchParams} />
    </Suspense>
  );
}
