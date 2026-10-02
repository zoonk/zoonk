import { PublicDisclosure } from "@/components/public/public-disclosure";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

const PLUS_QUESTIONS_ID = "plus-questions";
const ANSWER_CLASS = "text-muted-foreground text-[15px] leading-relaxed text-pretty sm:text-base";
const ANSWER_LINK_CLASS = "text-foreground font-medium underline underline-offset-4";

/** Keeps each number on the line of the word after it, so a narrow answer never strands a "3". */
function keepNumbersWithWords(text: string) {
  return text.replaceAll(/(?<=\d) /gu, "\u00A0");
}

function renderFairUseLink(chunks: ReactNode) {
  return (
    <Link className={ANSWER_LINK_CLASS} href="/terms#fair-use">
      {chunks}
    </Link>
  );
}

function renderSupportLink(chunks: ReactNode) {
  return (
    <Link className={ANSWER_LINK_CLASS} href="/support">
      {chunks}
    </Link>
  );
}

/**
 * The free plan's limits, read from the same rules the allowance enforces, so the answer can't
 * drift from what learners get. Trying lessons without an account only matters to someone who
 * doesn't have one.
 */
async function FreePlanAnswer({ hasNoAccount }: { hasNoAccount: boolean }) {
  const t = await getExtracted();
  const limits = getFreePlanLimits();

  const lead =
    hasNoAccount && limits.guestLessons !== null
      ? t(
          "Try {count, plural, one {# lesson} other {# lessons}} without an account. With a free account, you get:",
          { count: limits.guestLessons },
        )
      : t("With the free plan, you get:");

  const items = [
    t("{count, plural, one {# goal} other {# goals}} at a time", {
      count: limits.activeGoals ?? 0,
    }),
    t("{day, plural, one {# lesson} other {# lessons}} a day, up to {month, number} a month", {
      day: limits.lessonsPerDay ?? 0,
      month: limits.lessonsPerMonth ?? 0,
    }),
    t(
      "{days, plural, =7 {The first week} one {The first day} other {The first # days}} of exam prep",
      { days: limits.examPrepDays ?? 0 },
    ),
    t(
      "{tutor, plural, one {# tutor message} other {# tutor messages}}, {conversations, plural, one {# speaking conversation} other {# speaking conversations}} and {uploads, plural, one {# upload} other {# uploads}} a day",
      {
        conversations: limits.conversationsPerDay ?? 0,
        tutor: limits.tutorMessagesPerDay ?? 0,
        uploads: limits.uploadsPerDay ?? 0,
      },
    ),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className={ANSWER_CLASS}>{lead}</p>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li className={cn(ANSWER_CLASS, "flex gap-3")} key={item}>
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

/**
 * What people ask before paying, one tap away under the offer. Plus's limits only stop automated
 * use, so "Unlimited" needs no footnote: one answer says so and links the fair use policy. The
 * free plan's limits live here too, for whoever wants them, instead of crowding the offer.
 */
export async function PlusQuestions({ hasNoAccount }: { hasNoAccount: boolean }) {
  const t = await getExtracted();

  return (
    <section aria-labelledby={PLUS_QUESTIONS_ID} className="flex flex-col gap-4 pt-8">
      <h2 className="text-lg font-semibold tracking-tight" id={PLUS_QUESTIONS_ID}>
        {t("Common questions")}
      </h2>

      <div>
        <PublicDisclosure summary={t("What's in the free plan?")}>
          <FreePlanAnswer hasNoAccount={hasNoAccount} />
        </PublicDisclosure>

        <PublicDisclosure summary={t("Is Plus really unlimited?")}>
          <p className={ANSWER_CLASS}>
            {t.rich(
              "Yes. Learn as much as you want. Our limits are only there to stop bots and automated tools, not people learning. <link>Read our fair use policy</link>.",
              { link: renderFairUseLink },
            )}
          </p>
        </PublicDisclosure>

        <PublicDisclosure summary={t("What happens if I cancel?")}>
          <p className={ANSWER_CLASS}>
            {t(
              "You keep Plus until the end of the period you already paid for. Then you're back on the free plan, and your goals and progress stay with you.",
            )}
          </p>
        </PublicDisclosure>

        <PublicDisclosure summary={t("Can I get a refund?")}>
          <p className={ANSWER_CLASS}>
            {t.rich(
              "Just <link>contact us</link> and tell us what happened. We'll do our best to get you a refund.",
              { link: renderSupportLink },
            )}
          </p>
        </PublicDisclosure>
      </div>
    </section>
  );
}
