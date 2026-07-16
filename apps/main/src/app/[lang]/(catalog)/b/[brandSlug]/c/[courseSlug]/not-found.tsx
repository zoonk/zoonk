import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@zoonk/ui/components/empty";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Image from "next/image";

/**
 * Gives learners a useful next step when a course or one of its chapters is no
 * longer available instead of leaving them at Next.js's generic 404 page.
 */
export default async function CourseNotFound() {
  const t = await getExtracted();

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 py-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)] lg:gap-16 lg:py-16">
      <Empty className="items-start border-0 p-0 text-left">
        <EmptyHeader align="start" className="max-w-2xl gap-5">
          <EmptyTitle
            aria-level={1}
            className="text-4xl leading-[0.95] font-bold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl"
            role="heading"
          >
            {t("You found a course that hasn't been written yet")}
          </EmptyTitle>

          <p className="text-muted-foreground max-w-xl text-base/relaxed text-pretty sm:text-lg/relaxed">
            {t(
              "Tell us what you want to learn. We'll turn it into a clear, step-by-step course made for you.",
            )}
          </p>
        </EmptyHeader>

        <EmptyContent align="stretch" className="max-w-none sm:w-auto">
          <Link
            className={buttonVariants({ size: "lg", variant: "outline" })}
            href="/start/learn"
            prefetch
          >
            {t("Create this course")}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </EmptyContent>
      </Empty>

      <div className="flex items-center justify-center">
        <Image
          alt={t("An open book becoming a learning path")}
          className="h-auto w-full max-w-72 drop-shadow-[0_24px_32px_rgb(15_23_42/0.12)] sm:max-w-sm lg:max-w-md dark:drop-shadow-[0_24px_32px_rgb(0_0_0/0.4)]"
          height={1254}
          preload
          sizes="(min-width: 1024px) 42vw, (min-width: 640px) 384px, 288px"
          src="/catalog/course-not-found.webp"
          width={1254}
        />
      </div>
    </main>
  );
}
