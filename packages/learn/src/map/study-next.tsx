"use client";

import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ArrowRightIcon, FlagIcon, LibraryIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { useLevelName } from "../course/use-level-name";
import { LearnLink } from "../learn-link";
import { useFieldMap } from "./field-map-context";

/** "Continue at Beginner": one tap starts the next level; the host opens the new plan. */
function ContinueAtNextLevel({ next }: { next: NonNullable<StudyNextView["nextLevel"]> }) {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const levelName = useLevelName();
  const { actions } = useFieldMap();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      setFailed(!(await actions.continueNextLevel()));
    });
  };

  return (
    <div className="bg-background in-data-[mode=fun]:bg-fun-soft flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">
          {t("{course} · {level}", { course: next.title, level: levelName(next.level) })}
        </p>
        <p className="text-muted-foreground text-sm">
          {t("Go deeper with the next level. We start building its plan right away.")}
        </p>
      </div>
      <Button className="self-start" disabled={isPending} onClick={start} variant={primaryVariant}>
        {t("Continue at {level}", { level: levelName(next.level) })}
        <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
      {failed && (
        <p className="text-muted-foreground text-sm" role="status">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </div>
  );
}

function RelatedCourses({ related }: { related: StudyNextView["related"] }) {
  const t = useExtracted();
  const { hrefs } = useFieldMap();

  if (related.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-sm">{t("Related courses")}</h3>
      <ul className="flex flex-col">
        {related.map((course) => (
          <li key={course.courseId}>
            <LearnLink
              className="flex items-start gap-3 py-3 text-sm font-medium underline-offset-4 hover:underline"
              href={hrefs.course(course)}
            >
              <LineMarker aria-hidden="true">
                <LibraryIcon className="text-muted-foreground size-4" />
              </LineMarker>
              {course.title}
            </LearnLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Once every lesson is done: the map above is everything learned, and this is where to go next,
 * the next level of the same course with one tap, and the other courses the plan drew from.
 */
export function StudyNext() {
  const t = useExtracted();
  const { map } = useFieldMap();

  if (!map.next) {
    return null;
  }

  const { nextLevel, related } = map.next;

  return (
    <section
      aria-labelledby="study-next-title"
      className="bg-muted in-data-[mode=fun]:fun-glass flex flex-col gap-4 rounded-3xl p-4"
    >
      <div className="flex items-start gap-3">
        <FlagIcon aria-hidden="true" className="text-success mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold" id="study-next-title">
            {t("You finished your plan")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {nextLevel || related.length > 0
              ? t("Here's everything you learned. What to study next:")
              : t("Here's everything you learned.")}
          </p>
        </div>
      </div>

      {nextLevel && <ContinueAtNextLevel next={nextLevel} />}
      <RelatedCourses related={related} />
    </section>
  );
}
