import {
  PUBLIC_COLUMN_CLASS,
  PublicPage,
  PublicPageSkeleton,
} from "@/components/public/public-page";
import { Link, redirect } from "@/i18n/navigation";
import { getPlanLinkStartHref } from "@/lib/public/public-hrefs";
import { getPlanLink } from "@zoonk/core/plans/link";
import { getSession } from "@zoonk/core/users/session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanLinkTracker } from "./plan-link-tracker";
import { startPlanAction } from "./start-plan-action";
import { StartPlanForm } from "./start-plan-form";

type Props = PageProps<"/[lang]/plan-link/[planId]">;

const MINUTES_PER_HOUR = 60;

/** Only the subject shows in titles and previews: never the owner, their progress or answers. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ planId }, t] = await Promise.all([params, getExtracted()]);
  const result = await getPlanLink(planId);
  const subject = result.status === "ready" ? result.outline.subject : null;

  return {
    description: subject?.description ?? undefined,
    robots: { follow: false, index: false },
    title: subject ? t("A plan for {subject}", { subject: subject.title }) : t("A study plan"),
  };
}

async function PlanLinkBody({ params }: Props) {
  const [{ lang, planId }, t] = await Promise.all([params, getExtracted()]);
  const [result, session] = await Promise.all([getPlanLink(planId), getSession()]);

  if (result.status !== "ready") {
    notFound();
  }

  if (result.owner) {
    redirect({ href: "/plan", locale: getSupportedLocaleFromLanguage(lang) });
  }

  const { outline } = result;
  const totalMinutes = Math.round(outline.hours * MINUTES_PER_HOUR);

  // Under an hour counts in minutes, and a phase too small to measure shows no size, so nothing
  // ever reads "~0 h".
  const phaseSize = (hours: number) => {
    const minutes = Math.round(hours * MINUTES_PER_HOUR);

    if (minutes <= 0) {
      return null;
    }

    return minutes < MINUTES_PER_HOUR
      ? t("~{minutes, number} min", { minutes })
      : t("~{hours, number} h", { hours: Math.round(hours) });
  };

  const counts = { phases: outline.phases.length, skills: outline.skillCount };

  return (
    <div className={cn(PUBLIC_COLUMN_CLASS, "flex flex-col gap-8 py-10")}>
      <PlanLinkTracker planId={planId} />

      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">{t("A study plan someone shared with you")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {outline.subject?.title ?? t("A study plan")}
        </h1>
        {outline.subject?.description && (
          <p className="text-muted-foreground">{outline.subject.description}</p>
        )}
        <p className="text-muted-foreground text-sm">
          {totalMinutes < MINUTES_PER_HOUR
            ? t(
                "~{minutes, number} min of study · {phases, plural, one {# phase} other {# phases}} · {skills, plural, one {# skill} other {# skills}}",
                { ...counts, minutes: Math.max(1, totalMinutes) },
              )
            : t(
                "~{hours, number} h of study · {phases, plural, one {# phase} other {# phases}} · {skills, plural, one {# skill} other {# skills}}",
                { ...counts, hours: Math.round(outline.hours) },
              )}
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {outline.phases.map((phase, index) => (
          <li className="flex items-start gap-3 rounded-2xl border px-4 py-3" key={phase.name}>
            {/* The number sits on the name's first line when the name or its details wrap. */}
            <LineMarker aria-hidden="true" className="text-sm">
              <span className="bg-muted flex size-7 items-center justify-center rounded-full text-xs font-semibold">
                {index + 1}
              </span>
            </LineMarker>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{phase.name}</span>
              <span className="text-muted-foreground text-xs">
                {[phaseSize(phase.hours), phase.milestone].filter(Boolean).join(" · ")}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <section className="bg-muted flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">{t("Make it yours")}</h2>
          <p className="text-muted-foreground text-sm">
            {t(
              "You get your own plan for the same subject, at your own pace. A few questions then skip what you already know.",
            )}
          </p>
        </div>
        {session ? (
          <StartPlanForm action={startPlanAction.bind(null, planId)} />
        ) : (
          <Link
            className={buttonVariants({ size: "lg" })}
            href={getPlanLinkStartHref({ goal: outline.subject?.title ?? "", planId })}
          >
            {t("Start from this plan")}
          </Link>
        )}
      </section>
    </div>
  );
}

/** Someone else's plan: its subject and shape, and a way to start your own from it. */
export default function PlanLinkPage(props: Props) {
  return (
    <Suspense fallback={<PublicPageSkeleton />}>
      <PublicPage>
        <PlanLinkBody {...props} />
      </PublicPage>
    </Suspense>
  );
}
