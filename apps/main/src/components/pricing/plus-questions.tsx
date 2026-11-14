import { CheckItem } from "@/components/public/check-mark";
import {
  DISCLOSURE_ANSWER_CLASS,
  DISCLOSURE_LINK_CLASS,
  PublicDisclosure,
  renderHelpLink,
} from "@/components/public/public-disclosure";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { ForViewer } from "./for-viewer";
import { type PlusViewerState } from "./plus-plan";

const PLUS_QUESTIONS_ID = "plus-questions";

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
            "You can try {count, plural, one {# lesson} other {# lessons}} with no account. With a free account, you get:",
            { count: limits.guestLessons },
          )
        : t("Without Plus, you get:")}
    </p>
  );

  const items = [
    t("{count, plural, one {# goal} other {# goals}} at a time", {
      count: limits.activeGoals ?? 0,
    }),
    t(
      "{month, plural, one {# lesson} other {# lessons}} a month, across all your goals, exams included",
      { month: limits.lessonsPer30Days ?? 0 },
    ),
    t("An AI study buddy: {count, plural, one {# message} other {# messages}} a day", {
      count: limits.tutorMessagesPerDay ?? 0,
    }),
    t({
      description:
        "What a learner without Plus gets: they can add files of their own (notes, a syllabus) for a goal to study from. {count} is how many a day.",
      message: "Your own study material: {count, plural, one {# file} other {# files}} a day",
      values: { count: limits.uploadsPerDay ?? 0 },
    }),
    t("Speaking practice calls, fewer than with Plus"),
  ];

  return (
    <div className="flex flex-col gap-3">
      <ForViewer render={renderLead} viewerState={viewerState} />

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <CheckItem className={DISCLOSURE_ANSWER_CLASS} key={item}>
            {keepNumbersWithWords(item)}
          </CheckItem>
        ))}
      </ul>
    </div>
  );
}

/** Speaking calls have daily and monthly limits, said honestly but never in minutes, on any plan. */
export async function PlusQuestions({
  className,
  titleClassName = "text-base font-semibold tracking-[-0.015em]",
  viewerState,
}: {
  className?: string;
  titleClassName?: string;
  viewerState?: PlusViewerState;
}) {
  const t = await getExtracted();

  return (
    <section aria-labelledby={PLUS_QUESTIONS_ID} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className={titleClassName} id={PLUS_QUESTIONS_ID}>
          {t("Common questions")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t.rich("Still unsure? <link>Ask us</link>.", { link: renderHelpLink })}
        </p>
      </div>

      <div>
        <PublicDisclosure summary={t("What's free?")}>
          <FreePlanAnswer viewerState={viewerState} />
        </PublicDisclosure>

        <PublicDisclosure summary={t("Is Plus really unlimited?")}>
          <p className={DISCLOSURE_ANSWER_CLASS}>
            {t.rich(
              "For people learning, yes. Lessons, goals and the AI study buddy only have limits that stop bots and automated tools. Speaking calls have daily and monthly limits, higher than without Plus. <link>Read our fair use policy</link>.",
              { link: renderFairUseLink },
            )}
          </p>
        </PublicDisclosure>

        <PublicDisclosure summary={t("What happens if I cancel?")}>
          <p className={DISCLOSURE_ANSWER_CLASS}>
            {t({
              description:
                "“Back to free” means using Zoonk without paying again. Don't call it a “free plan” or use your language's word for the learner's study plan.",
              message:
                "You keep Plus until the end of the period you already paid for. Then you're back to free, and your goals and progress stay with you.",
            })}
          </p>
        </PublicDisclosure>

        <PublicDisclosure summary={t("Can I get a refund?")}>
          <p className={DISCLOSURE_ANSWER_CLASS}>
            {t.rich(
              "<link>Write to us</link> and we'll look into it. Purchases in the App Store or Google Play follow Apple's or Google's refund rules.",
              { link: renderHelpLink },
            )}
          </p>
        </PublicDisclosure>
      </div>
    </section>
  );
}
