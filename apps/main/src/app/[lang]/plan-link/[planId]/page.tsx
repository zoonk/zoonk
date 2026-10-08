import { HERO_CLASS, HERO_LEAD_CLASS, HERO_TITLE_CLASS } from "@/components/public/landing-styles";
import { PublicPage, PublicPageSkeleton } from "@/components/public/public-page";
import { StartBlock, getStartControlClassName } from "@/components/public/public-start";
import {
  RouteCard,
  RouteCardDivider,
  RouteCardEyebrow,
  RouteStop,
  type RouteStopState,
  RouteStops,
} from "@/components/public/route-card";
import { Link, redirect } from "@/i18n/navigation";
import { getPlanLinkStartHref } from "@/lib/public/public-hrefs";
import { getPlanLink } from "@zoonk/core/plans/link";
import { getSession } from "@zoonk/core/users/session";
import { PlanPhaseName } from "@zoonk/learn/plan/phase-name";
import { cn } from "@zoonk/ui/lib/utils";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { ArrowRightIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanLinkTracker } from "./plan-link-tracker";
import { startPlanAction } from "./start-plan-action";
import { StartPlanForm } from "./start-plan-form";

type Props = PageProps<"/[lang]/plan-link/[planId]">;

const MINUTES_PER_HOUR = 60;

/** The first phase is where the visitor's own plan would start, the last one is the goal. */
function getPhaseState(index: number, count: number): RouteStopState {
  if (index === 0) {
    return "now";
  }

  return index === count - 1 ? "goal" : "future";
}

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
    redirect({ href: "/journey", locale: getSupportedLocaleFromLanguage(lang) });
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

  const makeItYours = t(
    "You get your own plan for the same subject, at your own pace. A few questions then skip what you already know.",
  );

  return (
    <section aria-labelledby="plan-link-title" className={cn(HERO_CLASS, "pb-24 sm:pb-32")}>
      <PlanLinkTracker planId={planId} />

      <div className="min-w-0">
        <p className="text-muted-foreground text-sm font-medium sm:text-[15px]">
          {t("A study plan someone shared with you")}
        </p>

        <h1 className={cn(HERO_TITLE_CLASS, "mt-3 sm:mt-4")} id="plan-link-title">
          {outline.subject?.title ?? t("A study plan")}
        </h1>

        {outline.subject?.description && (
          <p className={HERO_LEAD_CLASS}>{outline.subject.description}</p>
        )}

        {session ? (
          <div className="mt-7 flex max-w-sm flex-col gap-3 sm:mt-9">
            <StartPlanForm action={startPlanAction.bind(null, planId)} />
            <p className="text-muted-foreground text-[13px] sm:text-sm">{makeItYours}</p>
          </div>
        ) : (
          <StartBlock note={makeItYours}>
            <Link
              className={getStartControlClassName()}
              href={getPlanLinkStartHref({ goal: outline.subject?.title ?? "", planId })}
            >
              {t("Start from this plan")}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </StartBlock>
        )}
      </div>

      <RouteCard className="lg:mt-3" label={t("A study plan")}>
        <RouteCardEyebrow>
          {totalMinutes < MINUTES_PER_HOUR
            ? t(
                "~{minutes, number} min of study · {phases, plural, one {# phase} other {# phases}} · {skills, plural, one {# skill} other {# skills}}",
                { ...counts, minutes: Math.max(1, totalMinutes) },
              )
            : t(
                "~{hours, number} h of study · {phases, plural, one {# phase} other {# phases}} · {skills, plural, one {# skill} other {# skills}}",
                { ...counts, hours: Math.round(outline.hours) },
              )}
        </RouteCardEyebrow>

        <RouteCardDivider />

        <RouteStops>
          {outline.phases.map((phase, index) => (
            <RouteStop
              aside={phaseSize(phase.hours)}
              detail={phase.milestone}
              // oxlint-disable-next-line react/no-array-index-key -- Phases are a fixed list in plan order.
              key={index}
              state={getPhaseState(index, outline.phases.length)}
              title={<PlanPhaseName phase={{ index, kind: phase.kind, name: phase.name }} />}
            />
          ))}
        </RouteStops>
      </RouteCard>
    </section>
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
