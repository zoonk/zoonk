import {
  SECTION_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
  TILE_CLASS,
} from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { MemoryPreview } from "./previews/memory-preview";
import { PreparationPreview } from "./previews/preparation-preview";
import { SessionPreview } from "./previews/session-preview";

function Problem({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <li className="flex flex-col md:row-span-3 md:grid md:grid-rows-subgrid md:pb-12 lg:pb-0">
      <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-balance sm:text-xl">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1.5 text-[15px] leading-relaxed text-pretty">
        {description}
      </p>
      <div className={cn(TILE_CLASS, "mt-4 p-4 sm:mt-5 sm:p-5")}>{children}</div>
    </li>
  );
}

/**
 * The three problems a plan takes off the learner's plate: what to study
 * today, keeping what they learn and knowing where they stand. Each answer
 * sits right under its problem.
 */
export async function HardPartSection() {
  const t = await getExtracted();

  return (
    <section aria-labelledby="hard-part-title" className={cn(SECTION_CLASS, "mt-24 sm:mt-40")}>
      <div className="max-w-[760px]">
        <h2 className={SECTION_TITLE_CLASS} id="hard-part-title">
          {t("The hard part isn't finding content.")}
        </h2>
        <p className={SECTION_LEAD_CLASS}>
          {t(
            "It's knowing what to study, keeping what you learn and knowing where you stand. Zoonk takes care of all three.",
          )}
        </p>
      </div>

      {/* From tablet width the titles, descriptions and previews share rows, so each lines up with
      its neighbors whatever the length of the text; the padding under each problem separates the
      rows on tablets. */}
      <ul className="mt-10 grid grid-cols-1 gap-12 sm:mt-12 md:grid-cols-2 md:gap-x-6 md:gap-y-0 lg:grid-cols-3 lg:gap-x-5">
        <Problem
          description={t(
            "Open the app and today's session is ready. It fits the minutes you have and skips what you already know.",
          )}
          title={t("Not sure what to study today?")}
        >
          <SessionPreview />
        </Problem>

        <Problem
          description={t(
            "Reviews come back right before you'd forget. Every mistake goes to a notebook and returns as practice.",
          )}
          title={t("Studied it, then forgot it?")}
        >
          <MemoryPreview />
        </Problem>

        <Problem
          description={t(
            "See what's still missing for your goal. The plan adapts, adding a lesson when you need one and moving time to weak spots.",
          )}
          title={t("Not sure where you stand?")}
        >
          <PreparationPreview />
        </Problem>
      </ul>
    </section>
  );
}
