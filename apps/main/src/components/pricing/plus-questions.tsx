import { PublicDisclosure } from "@/components/public/public-disclosure";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

const PLUS_QUESTIONS_ID = "plus-questions";
const ANSWER_CLASS = "text-muted-foreground text-[15px] leading-relaxed text-pretty sm:text-base";
const ANSWER_LINK_CLASS = "text-foreground font-medium underline underline-offset-4";

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
 * What people ask before paying, one tap away under the plans. Plus's limits only stop automated
 * use, so "Unlimited" needs no footnote: the first answer says so and links the fair use policy.
 * Trying first only matters to someone without an account; everyone else is on the free plan.
 */
export async function PlusQuestions({ hasNoAccount }: { hasNoAccount: boolean }) {
  const t = await getExtracted();
  const { guestLessons } = getFreePlanLimits();

  return (
    <section aria-labelledby={PLUS_QUESTIONS_ID} className="flex max-w-3xl flex-col gap-4 pt-8">
      <h2 className="text-lg font-semibold tracking-tight" id={PLUS_QUESTIONS_ID}>
        {t("Common questions")}
      </h2>

      <div>
        <PublicDisclosure summary={t("Is Plus really unlimited?")}>
          <p className={ANSWER_CLASS}>
            {t.rich(
              "Yes. Learn as much as you want. Our limits are only there to stop bots and automated tools, not people learning. <link>Read our fair use policy</link>.",
              { link: renderFairUseLink },
            )}
          </p>
        </PublicDisclosure>

        {hasNoAccount && guestLessons !== null && (
          <PublicDisclosure summary={t("Can I try Zoonk before paying?")}>
            <p className={ANSWER_CLASS}>
              {t(
                "Yes. Zoonk has a free plan, so you can try it before you pay. You don't even need an account for {count, plural, one {your first lesson} other {your first # lessons}}.",
                { count: guestLessons },
              )}
            </p>
          </PublicDisclosure>
        )}

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
