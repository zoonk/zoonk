import { CheckCircle } from "@/components/public/check-circle";
import { SECTION_CLASS, SECTION_TITLE_CLASS, TILE_CLASS } from "@/components/public/landing-styles";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { UserRoundIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * What the course makes someone able to do, in their words, with who it's for beside it, so a
 * visitor can recognize themselves before starting.
 */
export async function CourseOutcomes({
  audience,
  outcomes,
}: {
  audience: string[];
  outcomes: string[];
}) {
  const t = await getExtracted();

  if (outcomes.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        SECTION_CLASS,
        "mt-24 grid grid-cols-1 gap-12 sm:mt-36 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16",
      )}
    >
      <section aria-labelledby="course-outcomes">
        <h2 className={SECTION_TITLE_CLASS} id="course-outcomes">
          {t("What you'll be able to do")}
        </h2>

        <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 sm:mt-10 sm:grid-cols-2">
          {outcomes.map((outcome) => (
            <li className="flex gap-3.5 text-base leading-snug sm:text-[17px]" key={outcome}>
              <LineMarker>
                <CheckCircle size="md" />
              </LineMarker>
              <span className="text-pretty">{outcome}</span>
            </li>
          ))}
        </ul>
      </section>

      {audience.length > 0 && (
        <section
          aria-labelledby="course-audience"
          className={cn(TILE_CLASS, "self-start p-6 sm:p-7 lg:mt-2")}
        >
          <h2
            className="text-[19px] font-semibold tracking-[-0.015em] sm:text-xl"
            id="course-audience"
          >
            {t("Who it's for")}
          </h2>

          <ul className="mt-4 flex flex-col gap-3.5">
            {audience.map((item) => (
              <li className="flex gap-3 text-[15px] leading-snug" key={item}>
                <LineMarker>
                  <UserRoundIcon aria-hidden="true" className="text-muted-foreground size-4" />
                </LineMarker>
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
