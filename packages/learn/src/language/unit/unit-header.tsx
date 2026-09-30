"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../../learn-link";
import { UnitBadge, UnitLessonsBar } from "../unit-parts";

function UnitEyebrow({ unit }: { unit: LanguageUnitView["unit"] }) {
  const t = useExtracted();

  if (unit.position === null) {
    return unit.levelRange;
  }

  return t("Unit {position, number} · {levels}", {
    levels: unit.levelRange,
    position: unit.position,
  });
}

/** Back to Content, the unit's mark, "Unit 2 · A1–A2", its title and the lessons done. */
export function UnitHeader({ backHref, view }: { backHref: string; view: LanguageUnitView }) {
  const t = useExtracted();
  const { lessons, unit } = view;
  const done = lessons.filter((lesson) => lesson.done).length;

  return (
    <header className="flex flex-col gap-4">
      <LearnLink
        className={cn(
          buttonVariants({ size: "sm", variant: "ghost" }),
          "in-data-[mode=fun]:fun-glass -ml-2 self-start",
        )}
        href={backHref}
      >
        <ChevronLeftIcon aria-hidden="true" />
        {t("Content")}
      </LearnLink>

      <div className="flex items-center gap-4">
        <UnitBadge position={unit.position} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-muted-foreground text-xs font-medium">
            <UnitEyebrow unit={unit} />
          </p>
          <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {unit.title}
          </h1>
        </div>
      </div>

      {lessons.length > 0 && <UnitLessonsBar done={done} total={lessons.length} />}
    </header>
  );
}
