"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import {
  BrainIcon,
  ChartColumnIcon,
  ChevronRightIcon,
  MicIcon,
  NotebookTextIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { PlusNotice } from "../_components/plus-lock";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { SubjectIcon } from "../syllabus/subject-icon";
import { OfferCard, OfferLink, OfferTile } from "./tutor-offer-card";

type Offer<Kind extends TutorToolOffer["kind"]> = Extract<TutorToolOffer, { kind: Kind }>;

function CatalogCourseRow({
  course,
  href,
}: {
  course: NonNullable<Offer<"startGoal">["course"]>;
  href: string;
}) {
  const t = useExtracted();

  return (
    <div className="border-foreground/10 flex flex-col gap-1 border-t pt-3">
      <p className="text-muted-foreground text-xs">{t("A ready course in the catalog")}</p>
      <LearnLink
        className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 outline-none focus-visible:ring-[3px]"
        href={href}
      >
        <SubjectIcon imageUrl={course.imageUrl} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.9375rem] font-medium">{course.title}</span>
          {course.description && (
            <span className="text-muted-foreground line-clamp-2 text-[0.8125rem]">
              {course.description}
            </span>
          )}
        </span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
      </LearnLink>
    </div>
  );
}

export function StartGoalOffer({
  hrefs,
  offer,
}: {
  hrefs: { course: (course: { brandSlug: string; slug: string }) => string; start: string };
  offer: Offer<"startGoal">;
}) {
  const t = useExtracted();
  const locked = offer.access === "plusRequired";

  return (
    <OfferCard
      description={t("“{goal}”", { goal: offer.goal })}
      locked={locked}
      tile={
        <OfferTile>
          <PlusIcon />
        </OfferTile>
      }
      title={t("Start a new goal")}
    >
      {locked ? (
        <PlusNotice inset>
          {t(
            "The free plan follows one goal at a time: pause your current goal from its menu, or follow more than one with Plus.",
          )}
        </PlusNotice>
      ) : (
        <OfferLink href={hrefs.start}>{t("Start")}</OfferLink>
      )}

      {offer.course && (
        <CatalogCourseRow
          course={offer.course}
          href={hrefs.course({ brandSlug: offer.course.brandSlug, slug: offer.course.slug })}
        />
      )}
    </OfferCard>
  );
}

export function EssayOffer({ href, offer }: { href: string; offer: Offer<"essay"> }) {
  const t = useExtracted();
  const locked = offer.access === "plusRequired";

  const descriptions: Record<Offer<"essay">["cadence"], string> = {
    biweekly: t({
      description: "Describes how often essay practice comes in the learner's plan.",
      message: "Practiced every other week in your plan, each draft graded.",
    }),
    finalWeeks: t({
      description: "Describes how often essay practice comes in the learner's plan.",
      message: "Practiced in the final weeks before the exam, each draft graded.",
    }),
    weekly: t({
      description: "Describes how often essay practice comes in the learner's plan.",
      message: "Practiced every week in your plan, each draft graded.",
    }),
  };

  return (
    <OfferCard
      description={descriptions[offer.cadence]}
      locked={locked}
      tile={
        <OfferTile>
          <KindDot kind="essay" />
        </OfferTile>
      }
      title={offer.subject}
    >
      {locked ? (
        <PlusNotice inset>{t("Essay practice with grading comes with Plus.")}</PlusNotice>
      ) : (
        <OfferLink href={href}>{t("Open")}</OfferLink>
      )}
    </OfferCard>
  );
}

export function MistakesOffer({ href, offer }: { href: string; offer: Offer<"mistakes"> }) {
  const t = useExtracted();

  return (
    <OfferCard
      description={t(
        "{count, plural, one {# mistake to fix, with practice that brings it back.} other {# mistakes to fix, with practice that brings each one back.}}",
        { count: offer.open },
      )}
      tile={
        <OfferTile>
          <KindDot kind="mistakes" />
        </OfferTile>
      }
      title={t("Mistakes notebook")}
    >
      <OfferLink href={href}>{t("Open")}</OfferLink>
    </OfferCard>
  );
}

export function PronunciationOffer({
  href,
  offer,
}: {
  href: string;
  offer: Offer<"pronunciation">;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <OfferCard
      description={format.list(offer.words, { type: "conjunction" })}
      tile={
        <OfferTile className="text-warning">
          <MicIcon />
        </OfferTile>
      }
      title={t("{count, plural, one {Say # word again} other {Say # words again}}", {
        count: offer.count,
      })}
    >
      <OfferLink href={href}>{t("Practice")}</OfferLink>
    </OfferCard>
  );
}

export function PlaceOffer({
  href,
  kind,
}: {
  href: string;
  kind: Offer<"logbook" | "memory" | "stats">["kind"];
}) {
  const t = useExtracted();

  const places = {
    logbook: {
      description: t("What you did this week next to the last, and what comes next."),
      icon: <NotebookTextIcon />,
      title: t("Logbook"),
    },
    memory: {
      description: t("See, correct or delete what your buddy remembers about you."),
      icon: <BrainIcon />,
      title: t("Memory"),
    },
    stats: {
      description: t("Energy, level, right answers and when you study best."),
      icon: <ChartColumnIcon />,
      title: t("Statistics"),
    },
  } satisfies Record<typeof kind, { description: string; icon: React.ReactNode; title: string }>;

  const place = places[kind];

  return (
    <OfferCard
      description={place.description}
      tile={<OfferTile>{place.icon}</OfferTile>}
      title={place.title}
    >
      <OfferLink href={href}>{t("Open")}</OfferLink>
    </OfferCard>
  );
}

export function PlusOffer({ offer }: { offer: Offer<"plus"> }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <OfferCard
      description={
        offer.subscribed ? t("Your plan and its billing.") : t("What Plus includes and its price.")
      }
      tile={
        <OfferTile>
          <SparklesIcon />
        </OfferTile>
      }
      title={t("Plus")}
    >
      <OfferLink href={routes.upgrade}>{offer.subscribed ? t("Manage") : t("See Plus")}</OfferLink>
    </OfferCard>
  );
}
