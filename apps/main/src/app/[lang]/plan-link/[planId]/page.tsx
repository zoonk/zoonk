import { CatalogAsideBlock } from "@/components/catalog/catalog-aside";
import { HERO_CLASS, HERO_LEAD_CLASS, HERO_TITLE_CLASS } from "@/components/public/landing-styles";
import { NumberedRows } from "@/components/public/numbered-rows";
import { PublicPage, PublicPageSkeleton } from "@/components/public/public-page";
import { StartBlock, getStartControlClassName } from "@/components/public/public-start";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { Link, redirect } from "@/i18n/navigation";
import { getPlanLinkStartHref } from "@/lib/public/public-hrefs";
import { getMinutesFormatter } from "@/lib/public/public-labels";
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

/** Under an hour counts in minutes; from an hour on, in whole hours, since it's an estimate. */
function approximateMinutes(hours: number): number {
  const minutes = Math.round(hours * MINUTES_PER_HOUR);
  return minutes < MINUTES_PER_HOUR ? minutes : Math.round(hours) * MINUTES_PER_HOUR;
}

/** Only the subject shows in titles and previews: never the owner, their progress or answers. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getExtracted();
  const { planId } = await params;
  const result = await getPlanLink(planId);
  const subject = result.status === "ready" ? result.outline.subject : null;

  return {
    description: subject?.description ?? undefined,
    robots: { follow: false, index: false },
    title: subject ? t("A plan for {subject}", { subject: subject.title }) : t("A study plan"),
  };
}

async function PlanLinkBody({ params }: Props) {
  const t = await getExtracted();
  const duration = await getMinutesFormatter();
  const { lang, planId } = await params;
  const [result, session] = await Promise.all([getPlanLink(planId), getSession()]);

  if (result.status !== "ready") {
    notFound();
  }

  if (result.owner) {
    redirect({ href: "/plan", locale: getSupportedLocaleFromLanguage(lang) });
  }

  const { outline } = result;

  // A phase too small to measure shows no size, so nothing ever reads "~0 min".
  const phaseSize = (hours: number) => {
    const minutes = approximateMinutes(hours);
    return minutes > 0 ? t("~{time}", { time: duration(minutes) }) : null;
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
              {/* The time presets are onboarding's own, with the learn catalog's words. */}
              <ClientMessagesProvider scope="learn">
                <StartPlanForm action={startPlanAction.bind(null, planId)} />
              </ClientMessagesProvider>
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

        {/* The plan's phases as the course pages draw an outline: flat numbered rows, each with
            what it reaches and its size, where the plan starts on a soft fill. */}
        <div className="lg:mt-3">
          <CatalogAsideBlock
            facts={t(
              "~{time} of study · {phases, plural, one {# phase} other {# phases}} · {skills, plural, one {# skill} other {# skills}}",
              { ...counts, time: duration(Math.max(1, approximateMinutes(outline.hours))) },
            )}
            id="plan-link-phases"
            title={t("A study plan")}
          >
            <NumberedRows
              rows={outline.phases.map((phase, index) => ({
                description: phase.milestone ?? undefined,
                id: String(index),
                title: <PlanPhaseName phase={{ index, kind: phase.kind, name: phase.name }} />,
                trailing: phaseSize(phase.hours) ?? undefined,
              }))}
              startId="0"
            />
          </CatalogAsideBlock>
        </div>
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
