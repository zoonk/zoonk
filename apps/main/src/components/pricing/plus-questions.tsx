import {
  DISCLOSURE_ANSWER_CLASS,
  DISCLOSURE_LINK_CLASS,
  PublicDisclosure,
} from "@/components/public/public-disclosure";
import { getAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getSentenceSpace } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { ForViewer } from "./for-viewer";
import { type PlusViewerState } from "./plus-plan";

const PLUS_QUESTIONS_ID = "plus-questions";

const LEGAL_LINK_CLASS =
  "hover:text-foreground hit-area relative underline-offset-4 hover:underline";

function keepNumbersWithWords(text: string) {
  return text.replaceAll(/(?<=\d) /gu, "\u00A0");
}

function renderFairUseLink(chunks: ReactNode) {
  return (
    <Link className={DISCLOSURE_LINK_CLASS} href="/terms#fair-use">
      {chunks}
    </Link>
  );
}

function hasNoAccount(viewerState: PlusViewerState): boolean {
  return viewerState.status === "guest" || viewerState.status === "visitor";
}

async function FreePlanAnswer({ viewerState }: { viewerState?: PlusViewerState }) {
  const t = await getExtracted();
  const limits = getFreePlanLimits();

  const renderLead = (reader: PlusViewerState) => (
    <p className={DISCLOSURE_ANSWER_CLASS}>
      {hasNoAccount(reader) && limits.guestLessons !== null
        ? t(
            "Start free with {count, plural, one {# lesson} other {# lessons}}, no account needed. With a free account, you get:",
            { count: limits.guestLessons },
          )
        : t("With the free plan, you get:")}
    </p>
  );

  const items = [
    t("{count, plural, one {# goal} other {# goals}} at a time", {
      count: limits.activeGoals ?? 0,
    }),
    t("{month, plural, one {# lesson} other {# lessons}} a month, up to {day, number} a day", {
      day: limits.lessonsPerDay ?? 0,
      month: limits.lessonsPerMonth ?? 0,
    }),
    t(
      "{days, plural, =7 {The first week} one {The first day} other {The first # days}} of exam prep",
      { days: limits.examPrepDays ?? 0 },
    ),
    t(
      "{tutor, plural, one {# message to your buddy} other {# messages to your buddy}} and {uploads, plural, one {# upload} other {# uploads}} a day",
      { tutor: limits.tutorMessagesPerDay ?? 0, uploads: limits.uploadsPerDay ?? 0 },
    ),
    t("Practice calls, with lower limits than Plus (exam speaking tasks come with Plus)"),
  ];

  return (
    <div className="flex flex-col gap-3">
      <ForViewer render={renderLead} viewerState={viewerState} />

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li className={cn(DISCLOSURE_ANSWER_CLASS, "flex gap-3")} key={item}>
            <LineMarker>
              <span aria-hidden="true" className="bg-foreground/35 size-1.5 rounded-full" />
            </LineMarker>
            <span>{keepNumbersWithWords(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Speaking calls have daily and monthly limits, said honestly but never in minutes, on any plan. */
export async function PlusQuestions({
  className,
  viewerState,
}: {
  className?: string;
  viewerState?: PlusViewerState;
}) {
  const t = await getExtracted();
  const space = getSentenceSpace(await getAppLocale());
  // The address is a message of its own: each language writes to its own inbox (pt: contato@).
  const email = t("hello@zoonk.com");

  return (
    <section aria-labelledby={PLUS_QUESTIONS_ID} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight" id={PLUS_QUESTIONS_ID}>
          {t("Common questions")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("Still unsure?")}
          {space}
          <a
            className="text-foreground underline-offset-4 hover:underline"
            href={`mailto:${email}`}
          >
            {email}
          </a>
        </p>
      </div>

      <div>
        <PublicDisclosure summary={t("What's in the free plan?")}>
          <FreePlanAnswer viewerState={viewerState} />
        </PublicDisclosure>

        <PublicDisclosure summary={t("Is Plus really unlimited?")}>
          <p className={DISCLOSURE_ANSWER_CLASS}>
            {t.rich(
              "Almost. Lessons, goals and your buddy have limits only to stop bots and automated tools, not people learning. Speaking calls have daily and monthly limits, higher than on the free plan. <link>Read our fair use policy</link>.",
              { link: renderFairUseLink },
            )}
          </p>
        </PublicDisclosure>

        <PublicDisclosure summary={t("What happens if I cancel?")}>
          <p className={DISCLOSURE_ANSWER_CLASS}>
            {t(
              "You keep Plus until the end of the period you already paid for. Then you're back on the free plan, and your goals and progress stay with you.",
            )}
          </p>
        </PublicDisclosure>

        <PublicDisclosure summary={t("Can I get a refund?")}>
          <p className={DISCLOSURE_ANSWER_CLASS}>
            {t(
              "Write to us at {email} and we'll look into it. Purchases in the App Store or Google Play follow Apple's or Google's refund rules.",
              { email },
            )}
          </p>
        </PublicDisclosure>

        <p className="text-muted-foreground mt-6 text-sm">
          <Link className={LEGAL_LINK_CLASS} href="/terms">
            {t("Terms")}
          </Link>
        </p>
      </div>
    </section>
  );
}
