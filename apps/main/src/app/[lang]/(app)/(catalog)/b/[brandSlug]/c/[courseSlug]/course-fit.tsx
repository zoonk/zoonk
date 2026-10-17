import { CheckMark } from "@/components/public/check-mark";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** One of the card's lists under its quiet label, each item after a tick. */
function FitList({ id, items, title }: { id: string; items: string[]; title: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5">
      <h2 className="text-label" id={id}>
        {title}
      </h2>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li className="flex gap-3 text-[0.9375rem] leading-snug" key={item}>
            <LineMarker>
              <CheckMark size="sm" />
            </LineMarker>
            <span className="text-pretty">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Whether the course fits the visitor, in one card: what it makes them able to do and who it's
 * for, in the course's own words, so they can recognize themselves before starting. Nothing when
 * the course has neither.
 */
export async function CourseFit({
  audience,
  className,
  courseId,
  outcomes,
}: {
  audience: string[];
  className?: string;
  courseId: string;
  outcomes: string[];
}) {
  const t = await getExtracted();

  if (outcomes.length === 0 && audience.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        SURFACE_CLASS,
        "divided-rows flex flex-col px-5 py-0.5 sm:px-7 sm:py-1.5",
        className,
      )}
    >
      {outcomes.length > 0 && (
        <div className="py-5">
          <FitList
            id={`course-outcomes-${courseId}`}
            items={outcomes}
            title={t("What you'll be able to do")}
          />
        </div>
      )}

      {audience.length > 0 && (
        <div className="py-5">
          <FitList id={`course-audience-${courseId}`} items={audience} title={t("Who it's for")} />
        </div>
      )}
    </div>
  );
}
