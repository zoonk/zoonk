import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
import { getChapterView } from "@zoonk/core/view-models/chapter/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterScreenClient } from "./chapter-screen-client";

type Props = PageProps<"/[lang]/content/chapters/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Chapter") };
}

async function ChapterBody({ params }: Props) {
  const { chapterId, lang } = await params;
  const [result, session] = await Promise.all([getChapterView({ chapterId }), getSession()]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  // The chapter's "Ask" opens the player's questions sheet, so it needs the player's messages.
  return (
    <ClientMessagesProvider scope="player">
      <ChapterScreenClient
        canAsk={Boolean(session && !session.user.isAnonymous)}
        chapter={result.chapter}
      />
    </ClientMessagesProvider>
  );
}

function ChapterSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-24 rounded-full" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-3xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-48 w-full rounded-3xl" />
      <Skeleton className="h-28 w-full rounded-3xl" />
    </div>
  );
}

/**
 * A chapter of the learner's plan: its map, lessons with the next one to open, mistakes to
 * practice and saved summaries. A chapter outside the active goal's plan isn't found.
 */
export default function ChapterPage(props: Props) {
  return (
    <Suspense fallback={<ChapterSkeleton />}>
      <ChapterBody {...props} />
    </Suspense>
  );
}
