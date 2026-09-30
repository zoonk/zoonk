import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getSessionBlockReturn } from "@/lib/session/session-block-return";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { getSession } from "@zoonk/core/users/session";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MockClient } from "./mock-client";

type Props = PageProps<"/[lang]/mock/[blockId]">;

/** A mock is one learner's own exam: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Mock exam") };
}

function MockSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="mt-auto h-14 w-full rounded-full" />
      </main>
    </DeviceModeRoot>
  );
}

async function MockContent({ params, searchParams }: Props) {
  const [{ blockId, lang }, query] = await Promise.all([params, searchParams]);

  const [result, mode, buddy, session] = await Promise.all([
    getMock(blockId),
    getExperienceMode(),
    getLearnerBuddy(),
    getSession(),
  ]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <ModeProvider experienceMode={mode}>
      <MainLearnProvider>
        <MockClient
          canAsk={Boolean(session && !session.user.isAnonymous)}
          continueHref={
            getSessionBlockReturn({ query, sessionId: result.mock.sessionId }).continueHref
          }
          mock={result.mock}
          buddy={buddy}
        />
      </MainLearnProvider>
    </ModeProvider>
  );
}

/**
 * A mock exam in real conditions, full screen like the exam room: the week's Big Challenge in
 * Fun, the weekly mock exam in Focus.
 */
export default function MockPage(props: Props) {
  return (
    <Suspense fallback={<MockSkeleton />}>
      <MockContent {...props} />
    </Suspense>
  );
}
