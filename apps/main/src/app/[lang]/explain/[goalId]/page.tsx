import { AuthGateScreen } from "@/components/auth-gate";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { wordTutorSuggestions } from "@zoonk/player/tutor/suggestion-words";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExplainClient } from "./explain-client";

type Props = PageProps<"/[lang]/explain/[goalId]">;

export const metadata: Metadata = { robots: { follow: false, index: false } };

/**
 * A missing task's message is left to the browser here, unlike other task pages (`NotFoundPage`):
 * drawing the task's frame on the server too makes this page's scripts carry the frame's code
 * twice, about 11 KB more on every visit.
 */
async function ExplainContent({ params }: Props) {
  const { goalId } = await params;

  if (!isUuid(goalId)) {
    notFound();
  }

  const [result, session, profile, tutor] = await Promise.all([
    getExplanation({ goalId }),
    getSession(),
    getLearningProfile(),
    getTutorViewer(),
  ]);

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={`/explain/${goalId}`} />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  const { lesson } = result.explanation;
  const tutorSuggestions = lesson ? await wordTutorSuggestions(lesson.language) : [];

  return (
    <MainLearnProvider>
      <ExplainClient
        explanation={result.explanation}
        hasSession={Boolean(session)}
        soundsEnabled={profile?.soundsEnabled ?? true}
        tutor={tutor}
        tutorSuggestions={tutorSuggestions}
      />
    </MainLearnProvider>
  );
}

function ExplainSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 pt-20">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-5 w-2/3" />
    </main>
  );
}

export default function ExplainPage(props: Props) {
  return (
    <Suspense fallback={<ExplainSkeleton />}>
      <ExplainContent {...props} />
    </Suspense>
  );
}
