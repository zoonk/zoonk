import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ArrowLeftIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DiscoveryContent } from "./discovery-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Your learning plan") };
}

async function Discovery({ params }: Pick<PageProps<"/[lang]/start/discovery/[id]">, "params">) {
  const { id } = await params;

  const [result, locale, t] = await Promise.all([
    getCurrentUserCourseDiscovery({ discoveryId: id }),
    getLocale(),
    getExtracted(),
  ]);

  if (result.status === "unauthorized") {
    return redirect({
      href: `/login?next=${encodeURIComponent(`/start/discovery/${id}`)}`,
      locale,
    });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <>
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center gap-2 text-sm"
        href="/start/learn"
      >
        <ArrowLeftIcon className="size-4" />
        {t("Your request")}
      </Link>
      <DiscoveryContent initialDiscovery={result.discovery} />
    </>
  );
}

export default function DiscoveryPage(props: PageProps<"/[lang]/start/discovery/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6 sm:py-12">
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <Discovery params={props.params} />
      </Suspense>
    </main>
  );
}
